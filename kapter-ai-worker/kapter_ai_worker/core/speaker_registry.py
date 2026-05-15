from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("SpeakerRegistry")

CANDIDATE_MATCH_THRESHOLD = 0.62
CANDIDATE_MATCH_MARGIN = 0.08
CONFIRMED_MATCH_MARGIN = 0.06
CANDIDATE_MIN_DURATION_SECONDS = 1.25
CANDIDATE_PROMOTION_MIN_SIGHTINGS = 2
CANDIDATE_PROMOTION_MIN_DURATION_SECONDS = 6.0
CANDIDATE_PROMOTION_MIN_CONSISTENCY = 0.60
CONFIRMED_ANONYMOUS_UPDATE_MIN_DURATION_SECONDS = 2.5
KNOWN_PROFILE_UPDATE_MIN_DURATION_SECONDS = 2.0
MAX_CANDIDATE_SPEAKERS = 24
MAX_CANDIDATE_EXEMPLARS = 8
MAX_MEETING_SPEAKER_EXEMPLARS = 12
MAX_KNOWN_SPEAKER_EXEMPLARS = 25


def _normalize_embedding(embedding: np.ndarray) -> np.ndarray:
    normalized = embedding.astype(np.float32, copy=True)
    norm = np.linalg.norm(normalized)
    if norm > 0:
        normalized /= norm
    return normalized


@dataclass(slots=True)
class SpeakerExemplar:
    embedding: np.ndarray
    duration: float
    quality_score: float
    start_time: float
    end_time: float


@dataclass(slots=True)
class SpeakerMatchResult:
    label: str
    status: Literal[
        "confirmed_match",
        "candidate_match",
        "new_candidate",
        "unknown",
    ]
    best_score: float
    second_best_score: float
    should_update_profile: bool
    matched_candidate_id: str | None = None
    matched_speaker_id: str | None = None


@dataclass(slots=True)
class BaseSpeakerProfile:
    speaker_id: str
    profile_kind: Literal["known", "meeting", "candidate"]
    voice_profile_id: str | None = None
    exemplars: list[SpeakerExemplar] = field(default_factory=list)
    average_embedding: np.ndarray | None = None
    anchor_embedding: np.ndarray | None = None
    last_active_time: float = -1.0
    active_spans: list[tuple[float, float]] = field(default_factory=list)
    processed_intervals: list[tuple[float, float]] = field(default_factory=list)
    accepted_sightings: int = 0

    def update_activity(self, start_time: float, end_time: float) -> None:
        self.last_active_time = max(self.last_active_time, end_time)
        self.active_spans.append((start_time, end_time))

    def _max_exemplars(self) -> int:
        if self.profile_kind == "candidate":
            return MAX_CANDIDATE_EXEMPLARS
        if self.profile_kind == "meeting":
            return MAX_MEETING_SPEAKER_EXEMPLARS
        return MAX_KNOWN_SPEAKER_EXEMPLARS

    def should_update_from_turn(self, duration: float) -> bool:
        if self.profile_kind == "meeting":
            return duration >= CONFIRMED_ANONYMOUS_UPDATE_MIN_DURATION_SECONDS
        if self.profile_kind == "known":
            return duration >= KNOWN_PROFILE_UPDATE_MIN_DURATION_SECONDS
        return duration >= CANDIDATE_MIN_DURATION_SECONDS

    def update_profile(
        self,
        embedding: np.ndarray,
        start_time: float,
        end_time: float,
        *,
        quality_score: float = 1.0,
    ) -> bool:
        for s_start, s_end in self.processed_intervals:
            overlap = max(0.0, min(end_time, s_end) - max(start_time, s_start))
            if overlap > 0.8 * (end_time - start_time):
                return False

        normalized_embedding = _normalize_embedding(embedding)
        exemplar = SpeakerExemplar(
            embedding=normalized_embedding,
            duration=end_time - start_time,
            quality_score=quality_score,
            start_time=start_time,
            end_time=end_time,
        )
        self.update_activity(start_time, end_time)
        self.processed_intervals.append((start_time, end_time))
        self.accepted_sightings += 1
        if self.anchor_embedding is None:
            self.anchor_embedding = normalized_embedding
        self.exemplars.append(exemplar)
        self._prune_exemplars()
        self.update_average()
        return True

    def update_average(self) -> None:
        if not self.exemplars:
            self.average_embedding = None
            return

        average_embedding = np.mean(
            [exemplar.embedding for exemplar in self.exemplars],
            axis=0,
        )
        norm = np.linalg.norm(average_embedding)
        if norm > 0:
            average_embedding /= norm
            self.average_embedding = average_embedding.astype(np.float32, copy=False)
        else:
            self.average_embedding = None

    def _prune_exemplars(self) -> None:
        self.exemplars.sort(
            key=lambda exemplar: (
                exemplar.quality_score,
                exemplar.duration,
                exemplar.end_time,
            ),
            reverse=True,
        )
        self.exemplars = self.exemplars[: self._max_exemplars()]

    @property
    def accumulated_profile_duration(self) -> float:
        return float(sum(end - start for start, end in self.processed_intervals))

    def centroid_consistency(self) -> float:
        if self.average_embedding is None or not self.exemplars:
            return 0.0
        return float(
            np.mean(
                [
                    float(np.dot(self.average_embedding, exemplar.embedding))
                    for exemplar in self.exemplars
                ],
            ),
        )


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
        self._speakers: dict[str, BaseSpeakerProfile] = {}
        self._candidates: dict[str, BaseSpeakerProfile] = {}
        self._next_speaker_index = 0
        self._next_candidate_index = 0
        self._current_time = 0.0
        self._merged_map: dict[str, str] = {}

    def clear(self) -> None:
        self._speakers.clear()
        self._candidates.clear()
        self._next_speaker_index = 0
        self._next_candidate_index = 0
        self._current_time = 0.0
        self._merged_map.clear()

    def _effective_confirmed_threshold(
        self,
        duration: float,
    ) -> float:
        return self._glue_threshold + (
            self._match_threshold - self._glue_threshold
        ) * min(1.0, duration / 5.0)

    def _score_confirmed_speaker(
        self,
        speaker: BaseSpeakerProfile,
        embedding: np.ndarray,
    ) -> tuple[float, float, float, float]:
        centroid_score = (
            float(np.dot(embedding, speaker.average_embedding))
            if speaker.average_embedding is not None
            else -1.0
        )
        anchor_score = (
            float(np.dot(embedding, speaker.anchor_embedding))
            if speaker.anchor_embedding is not None
            else centroid_score
        )
        recent_scores = [
            float(np.dot(embedding, exemplar.embedding))
            for exemplar in speaker.exemplars[-3:]
        ]
        if recent_scores:
            recent_component = float(
                np.mean(sorted(recent_scores, reverse=True)[:2]),
            )
        else:
            recent_component = centroid_score

        final_score = (
            0.50 * centroid_score
            + 0.30 * anchor_score
            + 0.20 * recent_component
        )
        return final_score, centroid_score, anchor_score, recent_component

    def _score_candidate_speaker(
        self,
        speaker: BaseSpeakerProfile,
        embedding: np.ndarray,
    ) -> tuple[float, float, float]:
        centroid_score = (
            float(np.dot(embedding, speaker.average_embedding))
            if speaker.average_embedding is not None
            else -1.0
        )
        recent_scores = [
            float(np.dot(embedding, exemplar.embedding))
            for exemplar in speaker.exemplars[-3:]
        ]
        recent_component = max(recent_scores, default=centroid_score)
        final_score = (0.70 * centroid_score) + (0.30 * recent_component)
        return final_score, centroid_score, recent_component

    def _top_results(
        self,
        scored_entries: list[dict[str, object]],
    ) -> tuple[dict[str, object] | None, dict[str, object] | None]:
        if not scored_entries:
            return None, None

        ordered = sorted(
            scored_entries,
            key=lambda entry: float(entry["score"]),
            reverse=True,
        )
        return ordered[0], ordered[1] if len(ordered) > 1 else None

    def get_speaker(self, speaker_id: str) -> BaseSpeakerProfile | None:
        canonical_id = self.get_canonical_id(speaker_id)
        return self._speakers.get(canonical_id)

    def get_last_active_speaker(self) -> BaseSpeakerProfile | None:
        if not self._speakers:
            return None
        return max(self._speakers.values(), key=lambda speaker: speaker.last_active_time)

    def get_voice_profile_id(self, speaker_id: str) -> str | None:
        speaker = self.get_speaker(speaker_id)
        return speaker.voice_profile_id if speaker else None

    def match_speaker(
        self,
        embedding: np.ndarray,
        *,
        duration: float = 1.0,
        start_time: float = 0.0,
        end_time: float = 0.0,
        is_clean_turn: bool = True,
        allow_profile_update: bool = True,
        allow_candidate_creation: bool = True,
    ) -> SpeakerMatchResult:
        normalized_embedding = _normalize_embedding(embedding)
        self._current_time = max(self._current_time, end_time)

        scored_entries: list[dict[str, object]] = []
        confirmed_threshold = self._effective_confirmed_threshold(duration)

        for speaker_id, speaker in self._speakers.items():
            score, centroid_score, anchor_score, recent_component = (
                self._score_confirmed_speaker(speaker, normalized_embedding)
            )
            _logger.debug(
                "confirmed [{}]: centroid={:.4f} anchor={:.4f} recent={:.4f} final={:.4f} threshold={:.3f}",
                speaker_id,
                centroid_score,
                anchor_score,
                recent_component,
                score,
                confirmed_threshold,
            )
            scored_entries.append(
                {
                    "entry_type": "confirmed",
                    "speaker_id": speaker_id,
                    "score": score,
                    "threshold": confirmed_threshold,
                    "margin": CONFIRMED_MATCH_MARGIN,
                    "speaker": speaker,
                },
            )

        for candidate_id, candidate in self._candidates.items():
            score, centroid_score, recent_component = self._score_candidate_speaker(
                candidate,
                normalized_embedding,
            )
            _logger.debug(
                "candidate [{}]: centroid={:.4f} recent={:.4f} final={:.4f} threshold={:.3f}",
                candidate_id,
                centroid_score,
                recent_component,
                score,
                CANDIDATE_MATCH_THRESHOLD,
            )
            scored_entries.append(
                {
                    "entry_type": "candidate",
                    "speaker_id": candidate_id,
                    "score": score,
                    "threshold": CANDIDATE_MATCH_THRESHOLD,
                    "margin": CANDIDATE_MATCH_MARGIN,
                    "speaker": candidate,
                },
            )

        best_entry, second_entry = self._top_results(scored_entries)
        best_score = float(best_entry["score"]) if best_entry else -1.0
        second_best_score = float(second_entry["score"]) if second_entry else -1.0
        second_best_label = (
            str(second_entry["speaker_id"]) if second_entry is not None else None
        )

        _logger.info(
            "Speaker match result: best={} score={:.4f} second_best={}:{} duration={:.2f}s clean={}",
            best_entry["speaker_id"] if best_entry else None,
            best_score,
            second_best_label,
            f"{second_best_score:.4f}" if second_entry else "n/a",
            duration,
            is_clean_turn,
        )

        if best_entry is not None:
            best_threshold = float(best_entry["threshold"])
            best_margin = float(best_entry["margin"])
            is_above_threshold = best_score >= best_threshold
            has_margin = (
                second_entry is None
                or (best_score - second_best_score) >= best_margin
            )
            matched_speaker = best_entry["speaker"]
            assert isinstance(matched_speaker, BaseSpeakerProfile)

            if best_entry["entry_type"] == "confirmed" and is_above_threshold and has_margin:
                should_update_profile = (
                    allow_profile_update
                    and is_clean_turn
                    and matched_speaker.should_update_from_turn(duration)
                )
                if should_update_profile:
                    matched_speaker.update_profile(
                        normalized_embedding,
                        start_time,
                        end_time,
                    )
                else:
                    matched_speaker.update_activity(start_time, end_time)
                return SpeakerMatchResult(
                    label=str(best_entry["speaker_id"]),
                    status="confirmed_match",
                    best_score=best_score,
                    second_best_score=second_best_score,
                    should_update_profile=should_update_profile,
                    matched_speaker_id=str(best_entry["speaker_id"]),
                )

            if best_entry["entry_type"] == "candidate" and is_above_threshold and has_margin:
                should_update_profile = (
                    is_clean_turn
                    and allow_profile_update
                    and matched_speaker.should_update_from_turn(duration)
                )
                if should_update_profile:
                    matched_speaker.update_profile(
                        normalized_embedding,
                        start_time,
                        end_time,
                    )
                else:
                    matched_speaker.update_activity(start_time, end_time)

                promoted_speaker = self._promote_candidate_if_ready(str(best_entry["speaker_id"]))
                if promoted_speaker is not None:
                    promoted_speaker_id = promoted_speaker.speaker_id
                    return SpeakerMatchResult(
                        label=promoted_speaker_id,
                        status="confirmed_match",
                        best_score=best_score,
                        second_best_score=second_best_score,
                        should_update_profile=False,
                        matched_speaker_id=promoted_speaker_id,
                    )

                return SpeakerMatchResult(
                    label=str(best_entry["speaker_id"]),
                    status="candidate_match",
                    best_score=best_score,
                    second_best_score=second_best_score,
                    should_update_profile=should_update_profile,
                    matched_candidate_id=str(best_entry["speaker_id"]),
                )

            if best_entry["entry_type"] == "confirmed" and is_above_threshold and not has_margin:
                _logger.debug(
                    "Confirmed match rejected due to small margin: {} score={:.4f} second_best={:.4f}",
                    best_entry["speaker_id"],
                    best_score,
                    second_best_score,
                )
                return SpeakerMatchResult(
                    label="UNKNOWN",
                    status="unknown",
                    best_score=best_score,
                    second_best_score=second_best_score,
                    should_update_profile=False,
                )

            if best_entry["entry_type"] == "candidate" and is_above_threshold and not has_margin:
                _logger.debug(
                    "Candidate match rejected due to small margin: {} score={:.4f} second_best={:.4f}",
                    best_entry["speaker_id"],
                    best_score,
                    second_best_score,
                )
                return SpeakerMatchResult(
                    label="UNKNOWN",
                    status="unknown",
                    best_score=best_score,
                    second_best_score=second_best_score,
                    should_update_profile=False,
                )

        if (
            allow_candidate_creation
            and is_clean_turn
            and duration >= CANDIDATE_MIN_DURATION_SECONDS
        ):
            new_candidate = self._register_new_candidate(
                normalized_embedding,
                start_time,
                end_time,
            )
            return SpeakerMatchResult(
                label=new_candidate.speaker_id,
                status="new_candidate",
                best_score=best_score,
                second_best_score=second_best_score,
                should_update_profile=True,
                matched_candidate_id=new_candidate.speaker_id,
            )

        return SpeakerMatchResult(
            label="UNKNOWN",
            status="unknown",
            best_score=best_score,
            second_best_score=second_best_score,
            should_update_profile=False,
        )

    def identify_speaker(
        self,
        embedding: np.ndarray,
        duration: float = 1.0,
        start_time: float = 0.0,
        end_time: float = 0.0,
        update_profile: bool = True,
    ) -> str:
        result = self.match_speaker(
            embedding,
            duration=duration,
            start_time=start_time,
            end_time=end_time,
            is_clean_turn=update_profile,
            allow_profile_update=update_profile,
            allow_candidate_creation=update_profile,
        )
        if result.status == "confirmed_match":
            return result.label
        return "UNKNOWN"

    def _register_new_candidate(
        self,
        embedding: np.ndarray,
        start_time: float,
        end_time: float,
    ) -> BaseSpeakerProfile:
        self._next_candidate_index += 1
        candidate_id = f"C{self._next_candidate_index}"
        candidate = BaseSpeakerProfile(
            speaker_id=candidate_id,
            profile_kind="candidate",
        )
        candidate.update_profile(embedding, start_time, end_time)
        self._candidates[candidate_id] = candidate
        self._evict_candidates_if_needed()
        _logger.info("Candidate speaker created: {}", candidate_id)
        return candidate

    def _promote_candidate_if_ready(
        self,
        candidate_id: str,
    ) -> BaseSpeakerProfile | None:
        candidate = self._candidates.get(candidate_id)
        if candidate is None:
            return None

        if candidate.accepted_sightings < CANDIDATE_PROMOTION_MIN_SIGHTINGS:
            return None
        if candidate.accumulated_profile_duration < CANDIDATE_PROMOTION_MIN_DURATION_SECONDS:
            return None
        if len(candidate.processed_intervals) < CANDIDATE_PROMOTION_MIN_SIGHTINGS:
            return None
        if candidate.centroid_consistency() < CANDIDATE_PROMOTION_MIN_CONSISTENCY:
            return None

        self._next_speaker_index += 1
        speaker_id = f"P{self._next_speaker_index}"
        promoted = BaseSpeakerProfile(
            speaker_id=speaker_id,
            profile_kind="meeting",
            voice_profile_id=None,
            exemplars=list(candidate.exemplars),
            average_embedding=(
                candidate.average_embedding.copy()
                if candidate.average_embedding is not None
                else None
            ),
            anchor_embedding=(
                candidate.anchor_embedding.copy()
                if candidate.anchor_embedding is not None
                else None
            ),
            last_active_time=candidate.last_active_time,
            active_spans=list(candidate.active_spans),
            processed_intervals=list(candidate.processed_intervals),
            accepted_sightings=candidate.accepted_sightings,
        )
        self._speakers[speaker_id] = promoted
        self._candidates.pop(candidate_id, None)
        _logger.info(
            "Candidate promoted: {} -> {} (sightings={}, duration={:.2f}s, consistency={:.4f})",
            candidate_id,
            speaker_id,
            candidate.accepted_sightings,
            candidate.accumulated_profile_duration,
            candidate.centroid_consistency(),
        )
        return promoted

    def _evict_candidates_if_needed(self) -> None:
        while len(self._candidates) > MAX_CANDIDATE_SPEAKERS:
            evicted_id, evicted_profile = min(
                self._candidates.items(),
                key=lambda item: (
                    item[1].accumulated_profile_duration,
                    item[1].last_active_time,
                ),
            )
            self._candidates.pop(evicted_id, None)
            _logger.info(
                "Candidate evicted: {} (duration={:.2f}s, last_active={:.2f})",
                evicted_id,
                evicted_profile.accumulated_profile_duration,
                evicted_profile.last_active_time,
            )

    def add_known_speaker(
        self,
        speaker_id: str,
        embedding: np.ndarray | list[np.ndarray],
        *,
        voice_profile_id: str | None = None,
    ) -> None:
        raw_embeddings = embedding if isinstance(embedding, list) else [embedding]
        exemplars: list[SpeakerExemplar] = []
        normalized_embeddings: list[np.ndarray] = []

        for raw_embedding in raw_embeddings:
            normalized = _normalize_embedding(raw_embedding)
            normalized_embeddings.append(normalized)
            exemplars.append(
                SpeakerExemplar(
                    embedding=normalized,
                    duration=KNOWN_PROFILE_UPDATE_MIN_DURATION_SECONDS,
                    quality_score=1.0,
                    start_time=-1.0,
                    end_time=-1.0,
                ),
            )

        average_embedding = np.mean(normalized_embeddings, axis=0)
        average_norm = np.linalg.norm(average_embedding)
        if average_norm > 0:
            average_embedding /= average_norm

        self._speakers[speaker_id] = BaseSpeakerProfile(
            speaker_id=speaker_id,
            profile_kind="known",
            voice_profile_id=voice_profile_id,
            exemplars=exemplars[:MAX_KNOWN_SPEAKER_EXEMPLARS],
            anchor_embedding=normalized_embeddings[0],
            average_embedding=average_embedding.astype(np.float32, copy=False),
        )
        _logger.info("Loaded known speaker: {}", speaker_id)

    def consolidate_speakers(self) -> None:
        speaker_ids = list(self._speakers.keys())
        if len(speaker_ids) < 2:
            return

        for index, id1 in enumerate(speaker_ids):
            if id1 in self._merged_map:
                continue
            speaker_one = self._speakers.get(id1)
            if speaker_one is None or speaker_one.average_embedding is None:
                continue

            for id2 in speaker_ids[index + 1 :]:
                if id2 in self._merged_map:
                    continue
                speaker_two = self._speakers.get(id2)
                if speaker_two is None or speaker_two.average_embedding is None:
                    continue

                similarity = float(
                    np.dot(speaker_one.average_embedding, speaker_two.average_embedding),
                )
                if similarity > self._merge_threshold:
                    _logger.info(
                        "Merging speakers: {} -> {} (similarity: {:.4f})",
                        id2,
                        id1,
                        similarity,
                    )
                    self._merge_speakers(id1, id2)

    def _merge_speakers(self, primary_id: str, secondary_id: str) -> None:
        primary = self._speakers[primary_id]
        secondary = self._speakers[secondary_id]

        primary.exemplars.extend(secondary.exemplars)
        primary._prune_exemplars()
        primary.active_spans.extend(secondary.active_spans)
        primary.processed_intervals.extend(secondary.processed_intervals)
        primary.last_active_time = max(primary.last_active_time, secondary.last_active_time)
        primary.accepted_sightings += secondary.accepted_sightings
        if primary.anchor_embedding is None:
            primary.anchor_embedding = secondary.anchor_embedding
        primary.update_average()

        self._merged_map[secondary_id] = primary_id
        self._speakers.pop(secondary_id, None)

    def get_canonical_id(self, speaker_id: str) -> str:
        current_id = speaker_id
        while current_id in self._merged_map:
            current_id = self._merged_map[current_id]
        return current_id
