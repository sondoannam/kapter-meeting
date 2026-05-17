from __future__ import annotations

from collections import defaultdict
import re

import torch

from kapter_ai_worker.core.base_diarizer import BaseDiarizer
from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.models.speaker_embedding import SpeakerEmbedding
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("PyannoteDiarizer")
LOCAL_SPEAKER_MERGE_SIMILARITY = 0.84
LOCAL_SPEAKER_MIN_DURATION_FOR_MERGE = 3.0
SHORT_FALLBACK_MAX_DURATION_SECONDS = 0.45
SHORT_FALLBACK_MAX_GAP_SECONDS = 0.25
ANONYMOUS_LABEL_RE = re.compile(r"^P\d+$")


class PyannoteDiarizer(BaseDiarizer):
    """Speaker diarization adapter using pyannote.audio Pipeline."""

    def __init__(
        self,
        model_name: str = "pyannote/speaker-diarization-3.1",
        hf_token: str | None = None,
        device: str = "cuda",
        threshold: float = 0.5,
        min_cluster_size: int = 1,
        embedding_model: SpeakerEmbedding | None = None,
    ) -> None:
        from pyannote.audio import Pipeline

        self._embedding_model = embedding_model
        _logger.info(f"Loading pyannote pipeline '{model_name}' (device={device})...")
        self._pipeline = Pipeline.from_pretrained(
            model_name,
            token=hf_token,
        )

        torch_device = torch.device(device)
        self._pipeline.to(torch_device)

        # Apply sensitivity parameters for clustering
        params = {
            "clustering": {
                "method": "centroid",
                "min_cluster_size": min_cluster_size,
                "threshold": threshold, # This threshold (default 0.4) controls local over-segmentation
            }
        }
        self._pipeline.instantiate(params)

        self._sample_rate = 16000  # pyannote expects 16kHz mono
        _logger.info(
            f"Pyannote pipeline loaded and tuned (threshold={threshold}, min_cluster_size={min_cluster_size})."
        )

    def get_embedding_model(self) -> SpeakerEmbedding | None:
        """Expose the internal embedding model for standalone extraction."""
        return self._embedding_model

    @staticmethod
    def _is_anonymous_label(label: str) -> bool:
        return bool(ANONYMOUS_LABEL_RE.fullmatch(label))

    @staticmethod
    def _should_merge_local_speakers(
        *,
        similarity: float,
        primary_total_duration: float,
        secondary_total_duration: float,
    ) -> bool:
        return (
            similarity >= LOCAL_SPEAKER_MERGE_SIMILARITY
            and primary_total_duration >= LOCAL_SPEAKER_MIN_DURATION_FOR_MERGE
            and secondary_total_duration >= LOCAL_SPEAKER_MIN_DURATION_FOR_MERGE
        )

    @classmethod
    def _is_safe_short_fallback_label(cls, speaker_label: str) -> bool:
        return not cls._is_anonymous_label(speaker_label)

    def _build_local_merge_map(
        self,
        turns: list[tuple[object, object, str]],
        audio_chunk: AudioChunk,
    ) -> dict[str, str]:
        if self._embedding_model is None:
            return {}

        turns_by_label: dict[str, list[tuple[float, float]]] = defaultdict(list)
        for turn, _track, label in turns:
            turns_by_label[label].append((float(turn.start), float(turn.end)))

        representative_embeddings: dict[str, torch.Tensor | None] = {}
        total_durations: dict[str, float] = {}
        for label, spans in turns_by_label.items():
            total_durations[label] = sum(end - start for start, end in spans)
            longest_span = max(spans, key=lambda span: span[1] - span[0])
            longest_duration = longest_span[1] - longest_span[0]
            if longest_duration < max(1.2, self._embedding_model._min_duration):
                representative_embeddings[label] = None
                continue

            representative_embeddings[label] = self._embedding_model.get_embedding(
                audio_chunk,
                longest_span[0],
                longest_span[1],
            )

        merge_map: dict[str, str] = {}
        labels = sorted(
            turns_by_label.keys(),
            key=lambda label: total_durations.get(label, 0.0),
            reverse=True,
        )

        for primary_index, primary_label in enumerate(labels):
            primary_embedding = representative_embeddings.get(primary_label)
            if primary_embedding is None:
                continue

            canonical_primary = merge_map.get(primary_label, primary_label)
            if canonical_primary != primary_label:
                continue

            for secondary_label in labels[primary_index + 1 :]:
                if secondary_label in merge_map:
                    continue

                secondary_embedding = representative_embeddings.get(secondary_label)
                if secondary_embedding is None:
                    continue

                similarity = float(primary_embedding @ secondary_embedding)
                if not self._should_merge_local_speakers(
                    similarity=similarity,
                    primary_total_duration=total_durations.get(primary_label, 0.0),
                    secondary_total_duration=total_durations.get(secondary_label, 0.0),
                ):
                    continue

                merge_map[secondary_label] = primary_label
                _logger.debug(
                    "Locally merging diarization speakers {} -> {} (similarity={:.4f})",
                    secondary_label,
                    primary_label,
                    similarity,
                )

        return merge_map

    def diarize(self, audio_chunk: AudioChunk, registry: SpeakerRegistry | None = None, process_duration: float | None = None) -> list[SpeakerSpan]:
        """Perform diarization on the chunk and register speaker identities."""
        _logger.info(
            f"Diarizing chunk {audio_chunk.index} ({audio_chunk.duration_seconds:.1f}s) "
            f"with process_duration={process_duration}"
        )
        
        # Incremental Diarization: If process_duration is set, we only care about the end of the audio.
        # However, Pyannote works best with some context (at least 15-20s).
        # We handle the offset to return absolute timestamps correctly.
        time_offset = 0.0
        if process_duration and process_duration < audio_chunk.duration_seconds:
            time_offset = audio_chunk.duration_seconds - process_duration

        # Pyannote expects a dict {"waveform": Tensor(1, T), "sample_rate": int}
        waveform = torch.from_numpy(audio_chunk.samples).unsqueeze(0).float()
        audio_input = {
            "waveform": waveform,
            "sample_rate": audio_chunk.sample_rate,
        }

        output = self._pipeline(audio_input)

        # Pyannote Pipeline v3.1 may return annotation directly or under
        # .speaker_diarization depending on the exact model version
        if hasattr(output, 'speaker_diarization'):
            annotation = output.speaker_diarization
        else:
            annotation = output

        if not annotation:
            _logger.debug(
                f"Diarization returned empty annotation for chunk "
                f"[{audio_chunk.start_time:.1f}s - {audio_chunk.end_time:.1f}s]"
            )
            return []

        spans: list[SpeakerSpan] = []
        # Cache local-to-global mapping for this chunk to honor Pyannote's internal clustering
        local_to_global: dict[str, str] = {}
        
        # Hygiene: Pre-calculate overlaps within this chunk to avoid using mixed embeddings for profile updates
        turns = list(annotation.itertracks(yield_label=True))
        local_merge_map = self._build_local_merge_map(turns, audio_chunk)
        local_speaker_labels = sorted({label for _turn, _track, label in turns})
        _logger.debug(
            "Chunk {} produced {} local diarization turns across {} local speakers: {}",
            audio_chunk.index,
            len(turns),
            len(local_speaker_labels),
            local_speaker_labels,
        )
        
        for i, (turn_i, _track_i, local_speaker_i) in enumerate(turns):
            canonical_local_speaker = local_merge_map.get(local_speaker_i, local_speaker_i)
            # Check if this turn overlaps significantly with any other turn in the same chunk
            is_mixed = False
            for j, (turn_j, _track_j, local_speaker_j) in enumerate(turns):
                if i == j:
                    continue

                if local_merge_map.get(local_speaker_j, local_speaker_j) == canonical_local_speaker:
                    continue
                
                # Calculate overlap
                overlap = max(0, min(turn_i.end, turn_j.end) - max(turn_i.start, turn_j.start))
                if overlap > 0.1:  # More than 100ms overlap is risky
                    is_mixed = True
                    break

            # 1. Skip spans that end before our target process window
            if turn_i.end <= time_offset:
                continue
                
            # 2. Clip start time to our process window to avoid duplicating old segments
            start_in_chunk = max(turn_i.start, time_offset)
            end_in_chunk = turn_i.end
            duration = end_in_chunk - start_in_chunk
            
            if duration < 0.1: # Skip tiny fragments
                continue

            speaker_label = "UNKNOWN"
            embedding = None
            
            if registry and self._embedding_model:
                if canonical_local_speaker in local_to_global:
                    speaker_label = local_to_global[canonical_local_speaker]
                else:
                    # Extract embedding for this specific turn
                    embedding = self._embedding_model.get_embedding(audio_chunk, turn_i.start, turn_i.end)
                    if embedding is not None:
                        # Identify or Register
                        match_result = registry.match_speaker(
                            embedding,
                            duration=turn_i.end - turn_i.start,
                            start_time=audio_chunk.start_time + turn_i.start,
                            end_time=audio_chunk.start_time + turn_i.end,
                            is_clean_turn=not is_mixed,
                            allow_profile_update=not is_mixed,
                            allow_candidate_creation=not is_mixed,
                        )
                        if match_result.status == "confirmed_match":
                            speaker_label = match_result.label
                            if speaker_label != "UNKNOWN":
                                local_to_global[canonical_local_speaker] = speaker_label
                        else:
                            _logger.debug(
                                "Keeping local speaker {} as UNKNOWN in chunk {} "
                                "(status={}, label={}, duration={:.1f}s, mixed={})",
                                local_speaker_i,
                                audio_chunk.index,
                                match_result.status,
                                match_result.label,
                                turn_i.end - turn_i.start,
                                is_mixed,
                            )
                            speaker_label = "UNKNOWN"
                    else:
                        # Fallback for short segments without high-quality embeddings
                        if (
                            local_to_global
                            and duration <= SHORT_FALLBACK_MAX_DURATION_SECONDS
                        ):
                            # Prefer the speaker who was active most recently in this chunk
                            abs_turn_start = audio_chunk.start_time + turn_i.start
                            best_fallback = None
                            best_gap = float("inf")
                            for _local, _global in local_to_global.items():
                                if _global == "UNKNOWN":
                                    continue
                                if not self._is_safe_short_fallback_label(_global):
                                    continue
                                spk = registry.get_speaker(_global)
                                if spk and spk.active_spans:
                                    last_end = spk.active_spans[-1][1]
                                    gap = abs(abs_turn_start - last_end)
                                    if gap < best_gap:
                                        best_gap = gap
                                        best_fallback = _global
                            if (
                                best_fallback
                                and best_gap <= SHORT_FALLBACK_MAX_GAP_SECONDS
                            ):
                                speaker_label = best_fallback
                                local_to_global[canonical_local_speaker] = best_fallback
                        else:
                            last_global_speaker = registry.get_last_active_speaker()
                            if last_global_speaker:
                                abs_turn_start = audio_chunk.start_time + turn_i.start
                                gap = abs_turn_start - last_global_speaker.last_active_time
                                canonical_last_speaker = registry.get_canonical_id(
                                    last_global_speaker.speaker_id
                                )
                                if (
                                    duration <= SHORT_FALLBACK_MAX_DURATION_SECONDS
                                    and 0.0 <= gap <= SHORT_FALLBACK_MAX_GAP_SECONDS
                                    and self._is_safe_short_fallback_label(
                                        canonical_last_speaker
                                    )
                                ):
                                    speaker_label = canonical_last_speaker
                                    local_to_global[canonical_local_speaker] = speaker_label
                                    _logger.debug(
                                        "Global fallback match: {} (gap: {:.1f}s, duration: {:.1f}s)",
                                        speaker_label,
                                        gap,
                                        duration,
                                    )
                                else:
                                    _logger.debug(
                                        "No safe fallback for local speaker {} in chunk {} (duration: {:.1f}s, gap: {:.1f}s)",
                                        local_speaker_i,
                                        audio_chunk.index,
                                        duration,
                                        gap,
                                    )

            spans.append(
                SpeakerSpan(
                    speaker_label=speaker_label,
                    start_time=audio_chunk.start_time + start_in_chunk,
                    end_time=audio_chunk.start_time + end_in_chunk,
                )
            )

        return spans
