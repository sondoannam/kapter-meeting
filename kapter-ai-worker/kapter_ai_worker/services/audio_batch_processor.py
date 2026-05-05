from __future__ import annotations

import base64
from collections import OrderedDict
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import TYPE_CHECKING

import numpy as np

from kapter_ai_worker.config.settings import WorkerSettings
from kapter_ai_worker.contracts.worker_contracts import (
    WorkerAudioBatchRequest,
    WorkerTranscriptionResponse,
)
from kapter_ai_worker.core.entities import AudioChunk, DiarizedTranscriptSegment
from kapter_ai_worker.logging.logger import get_logger
from kapter_ai_worker.pipeline.streaming_pipeline import StreamingInferencePipeline
from kapter_ai_worker.utils.audio import (
    is_raw_pcm_mime_type,
    load_audio_file,
    load_raw_pcm_bytes,
)

MAX_ACTIVE_MEETING_REGISTRIES = 64
RECORDER_AUTHORITATIVE_SPEAKER_LABEL = "RECORDER"
logger = get_logger("audio_batch_processor")

if TYPE_CHECKING:
    from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


def infer_suffix_from_mime_type(mime_type: str) -> str:
    normalized_mime_type = mime_type.split(";", maxsplit=1)[0].strip().lower()

    mime_type_to_suffix = {
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/mp4": ".mp4",
    }

    return mime_type_to_suffix.get(normalized_mime_type, ".webm")


def build_processing_key(
    backend_meeting_id: str,
    source_type: str | None,
) -> str:
    if not source_type or source_type == "tab_mix":
        return backend_meeting_id

    return f"{backend_meeting_id}:{source_type}"


def is_meet_self_mic_request(request: WorkerAudioBatchRequest) -> bool:
    return (
        request.capture_context == "google_meet_room"
        and request.source_type == "self_mic"
    )


def resolve_authoritative_speaker_label(
    request: WorkerAudioBatchRequest,
) -> str | None:
    if not is_meet_self_mic_request(request):
        return None

    if request.authoritative_speaker_label:
        return request.authoritative_speaker_label

    return RECORDER_AUTHORITATIVE_SPEAKER_LABEL


def should_use_asr_only_processing(request: WorkerAudioBatchRequest) -> bool:
    return is_meet_self_mic_request(request)


def should_use_batch_local_processing(request: WorkerAudioBatchRequest) -> bool:
    return should_use_asr_only_processing(request)


def is_initial_sequence_window(request: WorkerAudioBatchRequest) -> bool:
    return request.sequence_start <= 1


def apply_authoritative_speaker_label(
    segments: list[DiarizedTranscriptSegment],
    speaker_label: str | None,
) -> list[DiarizedTranscriptSegment]:
    if not speaker_label:
        return segments

    return [
        DiarizedTranscriptSegment(
            speaker_label=speaker_label,
            text=segment.text,
            start_time=segment.start_time,
            end_time=segment.end_time,
            confidence=segment.confidence,
        )
        for segment in segments
    ]


def relativize_segments_to_batch_offset(
    segments: list[DiarizedTranscriptSegment],
    batch_offset_seconds: float,
) -> list[DiarizedTranscriptSegment]:
    return [
        DiarizedTranscriptSegment(
            speaker_label=segment.speaker_label,
            text=segment.text,
            start_time=segment.start_time - batch_offset_seconds,
            end_time=segment.end_time - batch_offset_seconds,
            confidence=segment.confidence,
        )
        for segment in segments
    ]


def clear_processing_buffer_state(
    processor: "AudioBatchProcessor",
    processing_key: str,
) -> None:
    processor._buffers_by_meeting.pop(processing_key, None)
    processor._buffer_starts_by_meeting.pop(processing_key, None)
    processor._sample_rates_by_meeting.pop(processing_key, None)


class AudioBatchProcessor:
    def __init__(
        self,
        settings: WorkerSettings,
        pipeline: StreamingInferencePipeline,
    ) -> None:
        self._settings = settings
        self._pipeline = pipeline
        self._overlap_duration = settings.real_model_overlap_duration_seconds
        self._target_chunk_duration = settings.real_model_chunk_duration_seconds

        # Multi-meeting state
        self._buffers_by_meeting: OrderedDict[str, np.ndarray] = OrderedDict()
        self._buffer_starts_by_meeting: dict[str, float] = {}
        self._sample_rates_by_meeting: dict[str, int] = {}
        self._registry_by_meeting: OrderedDict[str, SpeakerRegistry] = OrderedDict()

    def process_request(
        self,
        request: WorkerAudioBatchRequest,
    ) -> WorkerTranscriptionResponse:
        temporary_path: Path | None = None

        try:
            if (
                request.source_type == "self_mic"
                and not is_meet_self_mic_request(request)
            ):
                logger.warning(
                    "Ignoring self_mic worker batch outside Google Meet context for {}",
                    request.backend_meeting_id,
                )
                return WorkerTranscriptionResponse.from_entities(
                    stream_id=request.stream_id,
                    backend_meeting_id=request.backend_meeting_id,
                    sequence_start=request.sequence_start,
                    sequence_end=request.sequence_end,
                    stream_offset_ms=request.stream_offset_ms,
                    segments=[],
                    capture_context=request.capture_context,
                    source_type=request.source_type,
                )

            audio_bytes = base64.b64decode(request.audio_base64, validate=True)
            target_sample_rate = requested_sample_rate(self._settings)

            if is_raw_pcm_mime_type(request.mime_type):
                samples, sample_rate = load_raw_pcm_bytes(
                    audio_bytes,
                    request.mime_type,
                    target_sample_rate=target_sample_rate,
                )
            else:
                with NamedTemporaryFile(
                    suffix=infer_suffix_from_mime_type(request.mime_type),
                    delete=False,
                ) as temporary_file:
                    temporary_file.write(audio_bytes)
                    temporary_path = Path(temporary_file.name)

                samples, sample_rate = load_audio_file(
                    temporary_path,
                    target_sample_rate=target_sample_rate,
                )

            # 1. Update internal buffer
            current_offset_sec = request.stream_offset_ms / 1000.0
            processing_key = build_processing_key(
                request.backend_meeting_id,
                request.source_type,
            )
            use_batch_local_processing = should_use_batch_local_processing(request)
            initial_sequence_window = is_initial_sequence_window(request)
            batch_duration_seconds = len(samples) / sample_rate

            if use_batch_local_processing:
                if initial_sequence_window:
                    self._pipeline.clear(stream_id=processing_key)
                    self._registry_by_meeting.pop(processing_key, None)
                    logger.info(
                        f"New ASR-only session started for {processing_key}, pipeline state reset."
                    )

                clear_processing_buffer_state(self, processing_key)
            else:
                if (
                    initial_sequence_window
                    or processing_key not in self._buffers_by_meeting
                ):
                    self._buffers_by_meeting[processing_key] = samples
                    self._sample_rates_by_meeting[processing_key] = sample_rate
                    self._buffer_starts_by_meeting[processing_key] = current_offset_sec
                    if initial_sequence_window:
                        self._pipeline.clear(stream_id=processing_key)
                        self._registry_by_meeting.pop(processing_key, None)
                        logger.info(
                            f"New session started for {processing_key}, buffer and registry reset."
                        )
                else:
                    self._buffers_by_meeting[processing_key] = np.concatenate(
                        [self._buffers_by_meeting[processing_key], samples]
                    )
                    self._buffers_by_meeting.move_to_end(processing_key)

            if use_batch_local_processing:
                buffer_duration = batch_duration_seconds
                audio_chunk = AudioChunk(
                    index=request.sequence_start,
                    start_time=current_offset_sec,
                    end_time=current_offset_sec + batch_duration_seconds,
                    sample_rate=sample_rate,
                    samples=samples,
                    total_chunks=0,
                )
            else:
                buffer_duration = (
                    len(self._buffers_by_meeting[processing_key])
                    / self._sample_rates_by_meeting[processing_key]
                )

                # 2. Decision: Process now or wait?
                # We need at least enough for one full window (target_chunk_duration),
                # UNLESS this is the final batch of the meeting, in which case we process whatever is left.
                if buffer_duration < self._target_chunk_duration and not request.is_final:
                    return WorkerTranscriptionResponse.from_entities(
                        stream_id=request.stream_id,
                        backend_meeting_id=request.backend_meeting_id,
                        sequence_start=request.sequence_start,
                        sequence_end=request.sequence_end,
                        stream_offset_ms=request.stream_offset_ms,
                        segments=[],
                        capture_context=request.capture_context,
                        source_type=request.source_type,
                    )

                # 3. Prepare the chunk for processing with CORRECT start_time
                audio_chunk = AudioChunk(
                    index=request.sequence_start,
                    start_time=self._buffer_starts_by_meeting[processing_key],
                    end_time=self._buffer_starts_by_meeting[processing_key]
                    + buffer_duration,
                    sample_rate=self._sample_rates_by_meeting[processing_key],
                    samples=self._buffers_by_meeting[processing_key],
                    total_chunks=0,
                )

            meeting_registry = self._get_registry(processing_key)
            authoritative_speaker_label = (
                resolve_authoritative_speaker_label(request)
                if should_use_asr_only_processing(request)
                else None
            )
            pipeline_result = self._pipeline.process_chunk(
                audio_chunk,
                stream_id=processing_key,
                registry=meeting_registry,
                authoritative_speaker_label=authoritative_speaker_label,
            )

            if not use_batch_local_processing:
                # 4. Maintain the Sliding Window
                # Keep the overlap, and update the buffer_start_time for the next cycle
                overlap_samples_count = int(
                    self._overlap_duration * self._sample_rates_by_meeting[processing_key]
                )

                if len(self._buffers_by_meeting[processing_key]) > overlap_samples_count:
                    # How much did we advance?
                    advanced_samples = (
                        len(self._buffers_by_meeting[processing_key])
                        - overlap_samples_count
                    )
                    advanced_time = (
                        advanced_samples / self._sample_rates_by_meeting[processing_key]
                    )

                    self._buffers_by_meeting[processing_key] = self._buffers_by_meeting[
                        processing_key
                    ][-overlap_samples_count:]
                    self._buffer_starts_by_meeting[processing_key] += advanced_time
                    logger.debug(
                        f"Buffer advanced by {advanced_time:.2f}s, new start={self._buffer_starts_by_meeting[processing_key]:.2f}s"
                    )

            from kapter_ai_worker.utils.alignment import consolidate_segments

            # 6. Consolidate and deduplicate segments
            final_segments = consolidate_segments(
                pipeline_result.emitted_segments, registry=meeting_registry
            )
            final_segments = apply_authoritative_speaker_label(
                final_segments,
                authoritative_speaker_label,
            )
            response_offset_ms = max(0, int(round(audio_chunk.start_time * 1000)))
            final_segments = relativize_segments_to_batch_offset(
                final_segments,
                response_offset_ms / 1000.0,
            )

            if final_segments:
                for seg in final_segments:
                    logger.success(
                        f'Emitting to backend: [{seg.speaker_label}] ({seg.start_time:.1f}s-{seg.end_time:.1f}s) "{seg.text[:50]}..."'
                    )
            else:
                logger.debug("No new segments to emit in this chunk.")

            # Always enforce LRU eviction to prevent unbounded memory growth
            self._enforce_eviction()

            return WorkerTranscriptionResponse.from_entities(
                stream_id=request.stream_id,
                backend_meeting_id=request.backend_meeting_id,
                sequence_start=request.sequence_start,
                sequence_end=request.sequence_end,
                stream_offset_ms=response_offset_ms,
                segments=final_segments,
                capture_context=request.capture_context,
                source_type=request.source_type,
            )
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)

    def _get_registry(self, processing_key: str):
        from kapter_ai_worker.core.speaker_registry import SpeakerRegistry

        registry = self._registry_by_meeting.get(processing_key)
        if registry is None:
            registry = SpeakerRegistry(
                match_threshold=self._settings.speaker_match_threshold,
                glue_threshold=self._settings.speaker_glue_threshold,
                merge_threshold=self._settings.speaker_merge_threshold,
            )
            self._registry_by_meeting[processing_key] = registry
            logger.info(
                "Created speaker registry for processing key {}", processing_key
            )
        else:
            self._registry_by_meeting.move_to_end(processing_key)
        return registry

    def _enforce_eviction(self):
        while len(self._buffers_by_meeting) > MAX_ACTIVE_MEETING_REGISTRIES:
            evicted_id, _ = self._buffers_by_meeting.popitem(last=False)
            self._buffer_starts_by_meeting.pop(evicted_id, None)
            self._sample_rates_by_meeting.pop(evicted_id, None)
            self._registry_by_meeting.pop(evicted_id, None)
            self._pipeline.clear(stream_id=evicted_id)
            logger.info(
                f"Evicted least-recently-used resources for meeting {evicted_id}"
            )


def requested_sample_rate(settings: WorkerSettings) -> int:
    return settings.expected_sample_rate or 16000
