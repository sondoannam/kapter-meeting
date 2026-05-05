from __future__ import annotations

import torch
from pyannote.audio import Pipeline

from kapter_ai_worker.core.base_diarizer import BaseDiarizer
from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.models.speaker_embedding import SpeakerEmbedding
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("PyannoteDiarizer")


class PyannoteDiarizer(BaseDiarizer):
    """Speaker diarization adapter using pyannote.audio Pipeline."""

    def __init__(
        self,
        model_name: str = "pyannote/speaker-diarization-3.1",
        hf_token: str | None = None,
        device: str = "cuda",
        threshold: float = 0.5,
        embedding_model: SpeakerEmbedding | None = None,
    ) -> None:
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
                "min_cluster_size": 2,
                "threshold": threshold, # This threshold (default 0.4) controls local over-segmentation
            }
        }
        self._pipeline.instantiate(params)

        self._sample_rate = 16000  # pyannote expects 16kHz mono
        _logger.info(f"Pyannote pipeline loaded and tuned (threshold={threshold}).")

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
        
        for i, (turn_i, _track_i, local_speaker_i) in enumerate(turns):
            # Check if this turn overlaps significantly with any other turn in the same chunk
            is_mixed = False
            for j, (turn_j, _track_j, local_speaker_j) in enumerate(turns):
                if i == j:
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
                if local_speaker_i in local_to_global:
                    speaker_label = local_to_global[local_speaker_i]
                else:
                    # Extract embedding for this specific turn
                    embedding = self._embedding_model.get_embedding(audio_chunk, turn_i.start, turn_i.end)
                    if embedding is not None:
                        # Identify or Register
                        speaker_label = registry.identify_speaker(
                            embedding, 
                            duration=turn_i.end - turn_i.start, 
                            start_time=audio_chunk.start_time + turn_i.start,
                            end_time=audio_chunk.start_time + turn_i.end,
                            update_profile=not is_mixed
                        )
                        local_to_global[local_speaker_i] = speaker_label
                    else:
                        # Fallback for short segments without high-quality embeddings
                        if local_to_global:
                            # Prefer the speaker who was active most recently in this chunk
                            abs_turn_start = audio_chunk.start_time + turn_i.start
                            best_fallback = None
                            best_gap = float("inf")
                            for _local, _global in local_to_global.items():
                                if _global == "UNKNOWN":
                                    continue
                                spk = registry.get_speaker(_global)
                                if spk and spk.active_spans:
                                    last_end = spk.active_spans[-1][1]
                                    gap = abs(abs_turn_start - last_end)
                                    if gap < best_gap:
                                        best_gap = gap
                                        best_fallback = _global
                            if best_fallback and best_gap < 5.0:
                                speaker_label = best_fallback
                                local_to_global[local_speaker_i] = best_fallback
                        else:
                            last_global_speaker = registry.get_last_active_speaker()
                            if last_global_speaker:
                                abs_turn_start = audio_chunk.start_time + turn_i.start
                                # Global fallback: If no one has spoken in this chunk yet, check who was active 
                                # last in the meeting. This ensures continuity across chunk boundaries.
                                # We allow a small negative gap (-0.5s) to handle slight timestamp overlaps/jitters,
                                # but reject large overlaps (>0.5s) to avoid incorrect speaker assignment.
                                gap = abs_turn_start - last_global_speaker.last_active_time
                                if -0.5 < gap < 20.0:
                                    speaker_label = registry.get_canonical_id(last_global_speaker.speaker_id)
                                    local_to_global[local_speaker_i] = speaker_label
                                    _logger.debug(f"Global fallback match: {speaker_label} (gap: {gap:.1f}s)")

            spans.append(
                SpeakerSpan(
                    speaker_label=speaker_label,
                    start_time=audio_chunk.start_time + start_in_chunk,
                    end_time=audio_chunk.start_time + end_in_chunk,
                )
            )

        return spans