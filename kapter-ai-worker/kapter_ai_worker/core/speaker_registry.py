from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("SpeakerRegistry")


@dataclass
class KnownSpeaker:
    speaker_id: str
    embeddings: list[np.ndarray] = field(default_factory=list)
    average_embedding: np.ndarray | None = None
    anchor_embedding: np.ndarray | None = None
    
    last_active_time: float = -1.0
    active_spans: list[tuple[float, float]] = field(default_factory=list)
    processed_intervals: list[tuple[float, float]] = field(default_factory=list)

    def update_activity(self, start_time: float, end_time: float):
        self.last_active_time = max(self.last_active_time, end_time)
        self.active_spans.append((start_time, end_time))

    def update_profile(self, embedding: np.ndarray, start_time: float, end_time: float):
        """Update speaker profile with a new embedding, ensuring no duplicate processing of same time range."""
        # Hygiene: Check if this interval was already processed (for sliding window overlap)
        for s_start, s_end in self.processed_intervals:
            # If the new interval is mostly contained within an existing one, skip update
            overlap = max(0, min(end_time, s_end) - max(start_time, s_start))
            if overlap > 0.8 * (end_time - start_time):
                return

        duration = end_time - start_time
        self.update_activity(start_time, end_time)
        self.processed_intervals.append((start_time, end_time))
        
        if self.anchor_embedding is None and duration > 3.0:
            self.anchor_embedding = embedding
            
        self.embeddings.append(embedding)
        if len(self.embeddings) > 25:
            self.embeddings.pop(0)
            
        self.update_average()

    def update_average(self):
        if len(self.embeddings) == 0:
            return
        self.average_embedding = np.mean(self.embeddings, axis=0)
        norm = np.linalg.norm(self.average_embedding)
        if norm > 0:
            self.average_embedding /= norm
        else:
            self.average_embedding = None

    def overlaps_with(self, start: float, end: float) -> bool:
        for s_start, s_end in self.active_spans:
            if max(start, s_start) < min(end, s_end):
                return True
        return False


class SpeakerRegistry:

    def __init__(
        self,
        match_threshold: float = 0.5,
        glue_threshold: float = 0.45,
        merge_threshold: float = 0.62,
    ) -> None:
        self._match_threshold = match_threshold
        self._glue_threshold = glue_threshold
        self._merge_threshold = merge_threshold
        self._speakers: dict[str, KnownSpeaker] = {}
        self._next_speaker_index = 0
        self._current_time = 0.0
        self._merged_map: dict[str, str] = {}  # Track merged speaker IDs: id2 -> id1

    def get_speaker(self, speaker_id: str) -> KnownSpeaker | None:
        """Get a speaker by their canonical ID without accessing private dictionaries."""
        canonical_id = self.get_canonical_id(speaker_id)
        return self._speakers.get(canonical_id)

    def get_last_active_speaker(self) -> KnownSpeaker | None:
        """Safely get the speaker that was most recently active."""
        if not self._speakers:
            return None
        return max(self._speakers.values(), key=lambda s: s.last_active_time)

    def identify_speaker(
        self, 
        embedding: np.ndarray, 
        duration: float = 1.0, 
        start_time: float = 0.0, 
        end_time: float = 0.0,
        update_profile: bool = True
    ) -> str:
        self._current_time = max(self._current_time, end_time)
        
        if embedding is None:
            return "UNKNOWN"
            
        norm = np.linalg.norm(embedding)
        if norm == 0:
            return "UNKNOWN"
        embedding = embedding / norm

        # Dynamic Thresholding: Use a lower threshold for short segments to reduce UNKNOWNs,
        # but a higher one for profile updates to ensure stability.
        effective_threshold = self._glue_threshold + (self._match_threshold - self._glue_threshold) * min(1.0, duration / 5.0)

        best_score = -1.0
        best_speaker_id = None
        
        last_speaker = self.get_last_active_speaker()
        last_speaker_id = last_speaker.speaker_id if last_speaker else None

        for speaker_id, speaker in self._speakers.items():
            if not speaker.embeddings:
                continue
            
            # Nearest Exemplar Matching: Compare with Average, Anchor, and multiple recent samples.
            # This is much more stable than just using an average which can drift.
            scores = []
            if speaker.average_embedding is not None:
                scores.append(float(np.dot(embedding, speaker.average_embedding)))
            if speaker.anchor_embedding is not None:
                # Anchor gets a small weight boost as it is a known high-quality sample
                scores.append(float(np.dot(embedding, speaker.anchor_embedding)) + 0.02)
            
            # Check the 3 most recent embeddings (Exemplars)
            recent_exemplars = speaker.embeddings[-3:]
            for ex in recent_exemplars:
                scores.append(float(np.dot(embedding, ex)))
            
            current_score = max(scores, default=-1.0)
            
            # Active Speaker Bias: Increase to 0.12 to prevent identity flickering
            if speaker_id == last_speaker_id:
                current_score += 0.12
            
            if current_score > best_score:
                best_score = current_score
                best_speaker_id = speaker_id

        _logger.debug(f"Identifying speaker: score={best_score:.4f} (last={last_speaker_id}), duration={duration:.1f}s, target={effective_threshold:.3f}")

        # Hysteresis Epsilon: 1e-4 tolerance to prevent floating point noise 
        # (especially in fp16/cuda) from flipping the decision on threshold boundaries.
        EPSILON = 1e-4

        if best_speaker_id:
            # Case 1: Strong Match (Match Threshold)
            if best_score >= (effective_threshold - EPSILON):
                if update_profile and duration >= 1.5:
                    self._speakers[best_speaker_id].update_profile(embedding, start_time, end_time)
                else:
                    self._speakers[best_speaker_id].update_activity(start_time, end_time)
                return best_speaker_id
            
            # Case 2: Glue Match (for shorter segments that sound similar)
            elif best_score > (self._glue_threshold - EPSILON) and duration < 2.0:
                _logger.info(f"Glue match: {best_speaker_id} (score: {best_score:.4f}, dur={duration:.1f}s)")
                self._speakers[best_speaker_id].update_activity(start_time, end_time)
                return best_speaker_id

        # If no match and segment is long enough, register as new speaker
        # Optimization: If it's the very first speaker of the meeting, be more aggressive
        # (0.5s instead of 2.0s) to ensure the meeting intro gets a label.
        min_reg_duration = 0.5 if len(self._speakers) == 0 else 2.0
        
        if duration >= min_reg_duration:
            return self.register_new_speaker(embedding, start_time, end_time, best_score)
            
        return "UNKNOWN"

    def register_new_speaker(self, embedding: np.ndarray, start_time: float, end_time: float, best_score: float = 0.0) -> str:
        new_id = f"PERSON_{self._next_speaker_index}"
        self._next_speaker_index += 1
        _logger.info(f"New speaker detected: {new_id} (best match was {best_score:.4f})")
        
        new_speaker = KnownSpeaker(speaker_id=new_id)
        new_speaker.update_profile(embedding, start_time, end_time)
        self._speakers[new_id] = new_speaker
        
        return new_id

    def get_canonical_id(self, speaker_id: str) -> str:
        """Resolve the final speaker ID if it was merged into another."""
        current_id = speaker_id
        visited = {current_id}
        while current_id in self._merged_map:
            current_id = self._merged_map[current_id]
            if current_id in visited:  # Prevent infinite loops in case of cycles (though shouldn't happen)
                break
            visited.add(current_id)
        return current_id

    def _get_rep_embedding(self, speaker: KnownSpeaker):
        if speaker.average_embedding is not None:
            return speaker.average_embedding
        if speaker.anchor_embedding is not None:
            return speaker.anchor_embedding
        if speaker.embeddings:
            return speaker.embeddings[-1]
        return None

    def consolidate_speakers(self):
        speaker_ids = list(self._speakers.keys())
        merged_any = False
        
        for i in range(len(speaker_ids)):
            for j in range(i + 1, len(speaker_ids)):
                id1, id2 = speaker_ids[i], speaker_ids[j]
                if id1 not in self._speakers or id2 not in self._speakers:
                    continue
                    
                s1, s2 = self._speakers[id1], self._speakers[id2]

                e1 = self._get_rep_embedding(s1)
                e2 = self._get_rep_embedding(s2)

                if e1 is None or e2 is None:
                    continue

                sim = float(np.dot(e1, e2))
                if sim > self._merge_threshold:
                    has_overlap = False
                    for span1 in s1.active_spans:
                        if s2.overlaps_with(span1[0], span1[1]):
                            has_overlap = True
                            break
                    
                    if not has_overlap:
                        _logger.success(f"CONSOLIDATING: Merging {id2} into {id1} (similarity: {sim:.4f})")
                        
                        s1.embeddings.extend(s2.embeddings)
                        if len(s1.embeddings) > 25:
                            s1.embeddings = s1.embeddings[-25:]
                        s1.active_spans.extend(s2.active_spans)
                        s1.last_active_time = max(s1.last_active_time, s2.last_active_time)
                        s1.update_average()
                        
                        self._merged_map[id2] = id1
                        del self._speakers[id2]
                        merged_any = True
        return merged_any

    def clear(self):
        self._speakers = {}
        self._next_speaker_index = 0
        self._merged_map = {}
        _logger.info("Speaker registry cleared.")