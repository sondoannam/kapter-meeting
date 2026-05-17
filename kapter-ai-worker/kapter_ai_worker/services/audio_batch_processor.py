from __future__ import annotations

import base64
import re
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import TYPE_CHECKING

import numpy as np

from kapter_ai_worker.config.settings import WorkerSettings
from kapter_ai_worker.contracts.worker_contracts import (
    WorkerAudioBatchRequest,
    WorkerFileTranscriptionBatch,
    WorkerFileTranscriptionResponse,
    WorkerTranscriptionResponse,
    WorkerVoiceProfileEnrollmentResponse,
)
from kapter_ai_worker.core.entities import (
    AudioChunk,
    DiarizedTranscriptSegment,
    SpeakerEvidence,
    SpeakerSpan,
)
from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
from kapter_ai_worker.logging.logger import get_logger
from kapter_ai_worker.pipeline.streaming_pipeline import StreamingInferencePipeline
from kapter_ai_worker.services.voice_profile_cache import VoiceProfileCache
from kapter_ai_worker.utils.audio import (
    generate_vad_audio_chunks,
    is_raw_pcm_mime_type,
    load_audio_file,
    load_raw_pcm_bytes,
)

MAX_ACTIVE_MEETING_REGISTRIES = 64
RECORDER_AUTHORITATIVE_SPEAKER_LABEL = "RECORDER"
TARGET_RMS = 0.04
OVERLAP_RISK_SECONDS = 0.1
MEETING_EVIDENCE_MIN_DURATION_SECONDS = 2.0
logger = get_logger("audio_batch_processor")

if TYPE_CHECKING:
    from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


@dataclass(slots=True)
class AudioHealthMetrics:
    duration_seconds: float
    total_speech_duration: float
    speech_ratio: float
    rms_db: float
    quality_score: float


def compute_rms_db(samples: np.ndarray) -> float:
    if samples.size == 0:
        return -100.0

    rms = float(np.sqrt(np.mean(samples**2)))
    if rms <= 0:
        return -100.0

    return float(20.0 * np.log10(rms))


def compute_quality_score(
    *,
    duration_seconds: float,
    speech_ratio: float,
    rms_db: float,
) -> float:
    duration_score = min(1.0, duration_seconds / 6.0)
    speech_score = min(1.0, speech_ratio / 0.65) if speech_ratio > 0 else 0.0
    volume_score = min(1.0, max(0.0, (rms_db + 50.0) / 20.0))
    quality_score = (0.45 * duration_score) + (0.35 * speech_score) + (0.20 * volume_score)
    return round(quality_score, 4)


def normalize_audio(samples: np.ndarray, target_rms: float = 0.05) -> np.ndarray:
    """Normalize audio samples to a target RMS energy level (Auto-Gain)."""
    if samples.size == 0:
        return samples

    current_rms = np.sqrt(np.mean(samples**2))
    if current_rms < 1e-5:
        return samples

    gain = target_rms / current_rms
    normalized = samples * gain
    return np.clip(normalized, -1.0, 1.0)


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


def resolve_authoritative_speaker_assignment(
    request: WorkerAudioBatchRequest,
    registry: SpeakerRegistry | None = None,
    embedding: np.ndarray | None = None,
    duration: float = 0.0,
) -> tuple[str | None, str | None]:
    if not is_meet_self_mic_request(request):
        return None, None

    if registry and embedding is not None:
        match_result = registry.match_speaker(
            embedding,
            duration=duration,
            is_clean_turn=True,
            allow_profile_update=False,
            allow_candidate_creation=False,
        )
        identified_name = (
            match_result.label
            if match_result.status == "confirmed_match"
            else "UNKNOWN"
        )
        is_named = (
            identified_name
            and identified_name != "UNKNOWN"
            and not re.fullmatch(r"P\d+", identified_name)
        )
        if is_named:
            return identified_name, registry.get_voice_profile_id(identified_name)

    if request.authoritative_speaker_label:
        return request.authoritative_speaker_label, None

    return RECORDER_AUTHORITATIVE_SPEAKER_LABEL, None


def should_use_asr_only_processing(request: WorkerAudioBatchRequest) -> bool:
    return is_meet_self_mic_request(request)


def should_use_batch_local_processing(request: WorkerAudioBatchRequest) -> bool:
    return should_use_asr_only_processing(request)


def is_initial_sequence_window(request: WorkerAudioBatchRequest) -> bool:
    return request.sequence_start <= 1


def apply_authoritative_speaker_label(
    segments: list[DiarizedTranscriptSegment],
    speaker_label: str | None,
    voice_profile_id: str | None = None,
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
            voice_profile_id=voice_profile_id or segment.voice_profile_id,
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
            voice_profile_id=segment.voice_profile_id,
        )
        for segment in segments
    ]


def relativize_speaker_evidence_to_batch_offset(
    evidence: list[SpeakerEvidence],
    batch_offset_seconds: float,
) -> list[SpeakerEvidence]:
    return [
        SpeakerEvidence(
            speaker_label=item.speaker_label,
            start_time=item.start_time - batch_offset_seconds,
            end_time=item.end_time - batch_offset_seconds,
            duration_seconds=item.duration_seconds,
            embedding=item.embedding,
            source_type=item.source_type,
            rms_db=item.rms_db,
            speech_ratio=item.speech_ratio,
            quality_score=item.quality_score,
            sample_rate=item.sample_rate,
            voice_profile_id=item.voice_profile_id,
        )
        for item in evidence
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
        voice_profile_cache: VoiceProfileCache,
    ) -> None:
        self._settings = settings
        self._pipeline = pipeline
        self._voice_profile_cache = voice_profile_cache
        self._overlap_duration = settings.real_model_overlap_duration_seconds
        self._target_chunk_duration = settings.real_model_chunk_duration_seconds
        self._health_vad = self._build_health_vad()

        self._buffers_by_meeting: OrderedDict[str, np.ndarray] = OrderedDict()
        self._buffer_starts_by_meeting: dict[str, float] = {}
        self._sample_rates_by_meeting: dict[str, int] = {}
        self._registry_by_meeting: OrderedDict[str, SpeakerRegistry] = OrderedDict()

    def _build_health_vad(self) -> BaseVoiceActivityDetector:
        if self._settings.use_real_models:
            from kapter_ai_worker.models.silero_vad import SileroVAD

            return SileroVAD(threshold=self._settings.silero_vad_threshold)

        from kapter_ai_worker.models.mock_vad import MockVoiceActivityDetector

        return MockVoiceActivityDetector(
            energy_threshold=self._settings.vad_energy_threshold,
        )

    def process_request(
        self,
        request: WorkerAudioBatchRequest,
    ) -> WorkerTranscriptionResponse:
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
        samples, sample_rate = self._decode_audio_bytes(audio_bytes, request.mime_type)
        should_normalize_batch_immediately = should_use_batch_local_processing(request)
        normalized_samples = (
            normalize_audio(samples, target_rms=TARGET_RMS)
            if should_normalize_batch_immediately
            else samples
        )

        current_offset_sec = request.stream_offset_ms / 1000.0
        processing_key = build_processing_key(
            request.backend_meeting_id,
            request.source_type,
        )
        use_batch_local_processing = should_use_batch_local_processing(request)
        initial_sequence_window = is_initial_sequence_window(request)
        batch_duration_seconds = len(samples) / sample_rate

        if initial_sequence_window or processing_key not in self._buffers_by_meeting:
            if initial_sequence_window:
                self._pipeline.clear(stream_id=processing_key)
                self._registry_by_meeting.pop(processing_key, None)

            meeting_registry = self._get_registry(processing_key)

            if initial_sequence_window:
                self._seed_registry_from_cache(
                    meeting_registry,
                    request.known_voice_profile_ids,
                )

            if use_batch_local_processing:
                clear_processing_buffer_state(self, processing_key)
            else:
                self._buffers_by_meeting[processing_key] = samples
                self._sample_rates_by_meeting[processing_key] = sample_rate
                self._buffer_starts_by_meeting[processing_key] = current_offset_sec
        else:
            if not use_batch_local_processing:
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
                samples=normalized_samples,
                total_chunks=0,
            )
        else:
            buffer_duration = (
                len(self._buffers_by_meeting[processing_key])
                / self._sample_rates_by_meeting[processing_key]
            )

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

            audio_chunk = AudioChunk(
                index=request.sequence_start,
                start_time=self._buffer_starts_by_meeting[processing_key],
                end_time=self._buffer_starts_by_meeting[processing_key]
                + buffer_duration,
                sample_rate=self._sample_rates_by_meeting[processing_key],
                samples=normalize_audio(
                    self._buffers_by_meeting[processing_key],
                    target_rms=TARGET_RMS,
                ),
                total_chunks=0,
            )

        meeting_registry = self._get_registry(processing_key)

        authoritative_speaker_label = None
        authoritative_voice_profile_id = None
        if should_use_asr_only_processing(request):
            mic_embedding = None
            try:
                embedding_model = self._pipeline._diarizer.get_embedding_model()
                if embedding_model:
                    mic_embedding = embedding_model.get_embedding(
                        audio_chunk,
                        0.0,
                        audio_chunk.duration_seconds,
                    )
            except Exception as error:  # noqa: BLE001
                logger.warning(
                    "Failed to extract self-mic embedding for identification: {}",
                    error,
                )

            (
                authoritative_speaker_label,
                authoritative_voice_profile_id,
            ) = resolve_authoritative_speaker_assignment(
                request,
                registry=meeting_registry,
                embedding=mic_embedding,
                duration=audio_chunk.duration_seconds,
            )

        pipeline_result = self._pipeline.process_chunk(
            audio_chunk,
            stream_id=processing_key,
            registry=meeting_registry,
            authoritative_speaker_label=authoritative_speaker_label,
        )

        if not use_batch_local_processing:
            overlap_samples_count = int(
                self._overlap_duration * self._sample_rates_by_meeting[processing_key]
            )

            if len(self._buffers_by_meeting[processing_key]) > overlap_samples_count:
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

        from kapter_ai_worker.utils.alignment import consolidate_segments

        final_segments = consolidate_segments(
            pipeline_result.emitted_segments,
            registry=meeting_registry,
        )
        final_segments = apply_authoritative_speaker_label(
            final_segments,
            authoritative_speaker_label,
            authoritative_voice_profile_id,
        )

        speaker_evidence = pipeline_result.speaker_evidence or []
        if not speaker_evidence and not use_batch_local_processing:
            speaker_evidence = self._extract_speaker_evidence(
                audio_chunk,
                pipeline_result.speaker_spans,
                source_type=request.source_type,
                registry=meeting_registry,
            )

        response_offset_ms = max(0, int(round(audio_chunk.start_time * 1000)))
        final_segments = relativize_segments_to_batch_offset(
            final_segments,
            response_offset_ms / 1000.0,
        )
        speaker_evidence = relativize_speaker_evidence_to_batch_offset(
            speaker_evidence,
            response_offset_ms / 1000.0,
        )

        if final_segments:
            for seg in final_segments:
                logger.success(
                    'Emitting to backend: [{}] ({:.1f}s-{:.1f}s) "{}..."',
                    seg.speaker_label,
                    seg.start_time,
                    seg.end_time,
                    seg.text[:50],
                )

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
            speaker_evidence=speaker_evidence,
        )

    def extract_voice_profile_enrollment(
        self,
        audio_bytes: bytes,
        mime_type: str,
    ) -> WorkerVoiceProfileEnrollmentResponse:
        samples, sample_rate = self._decode_audio_bytes(audio_bytes, mime_type)
        samples = normalize_audio(samples, target_rms=TARGET_RMS)

        metrics = self._analyze_audio_health(samples, sample_rate)
        if (
            metrics.total_speech_duration
            < self._settings.min_voice_profile_enrollment_duration
        ):
            raise ValueError(
                "Enrollment audio is too short. Provide at least 3 seconds of clear speech."
            )

        if metrics.quality_score < self._settings.min_voice_profile_quality_score:
            raise ValueError(
                "Enrollment audio quality is too low. Reduce silence/noise and speak more clearly."
            )

        duration = len(samples) / sample_rate
        audio_chunk = AudioChunk(
            index=0,
            start_time=0.0,
            end_time=duration,
            sample_rate=sample_rate,
            samples=samples,
            total_chunks=1,
        )

        self._validate_single_speaker_enrollment(audio_chunk)

        diarizer = self._pipeline._diarizer
        embedding_model = diarizer.get_embedding_model()
        if embedding_model is None:
            raise RuntimeError("Embedding model not available in current pipeline mode.")

        embedding = embedding_model.get_embedding(audio_chunk, 0.0, duration)
        if embedding is None:
            raise ValueError("Audio clip is too short or too silent for enrollment.")

        return WorkerVoiceProfileEnrollmentResponse(
            embedding=[float(value) for value in embedding.tolist()],
            duration_seconds=duration,
            rms_db=metrics.rms_db,
            speech_ratio=metrics.speech_ratio,
            quality_score=metrics.quality_score,
            sample_rate=sample_rate,
        )

    def process_uploaded_audio_file(
        self,
        *,
        audio_bytes: bytes,
        mime_type: str,
        backend_meeting_id: str,
        stream_id: str,
        source_type: str,
        known_voice_profile_ids: list[str],
    ) -> WorkerFileTranscriptionResponse:
        if source_type != "tab_mix":
            raise ValueError("Uploaded meeting audio must use sourceType=tab_mix.")

        temporary_path: Path | None = None
        processing_key = build_processing_key(backend_meeting_id, source_type)

        try:
            with NamedTemporaryFile(
                suffix=infer_suffix_from_mime_type(mime_type),
                delete=False,
            ) as temporary_file:
                temporary_file.write(audio_bytes)
                temporary_path = Path(temporary_file.name)

            all_samples, sample_rate = load_audio_file(
                temporary_path,
                target_sample_rate=requested_sample_rate(self._settings),
            )
            total_duration_ms = max(
                1,
                int(round((len(all_samples) / sample_rate) * 1000)),
            )

            self._pipeline.clear(stream_id=processing_key)
            self._registry_by_meeting.pop(processing_key, None)
            clear_processing_buffer_state(self, processing_key)

            meeting_registry = self._get_registry(processing_key)
            self._seed_registry_from_cache(
                meeting_registry,
                known_voice_profile_ids,
            )

            worker_batches: list[WorkerFileTranscriptionBatch] = []
            audio_chunks = list(
                generate_vad_audio_chunks(
                    temporary_path,
                    vad=self._health_vad,
                    expected_sample_rate=requested_sample_rate(self._settings),
                    chunk_duration_seconds=self._target_chunk_duration,
                    overlap_duration_seconds=self._overlap_duration,
                )
            )

            if not audio_chunks:
                return WorkerFileTranscriptionResponse(
                    stream_id=stream_id,
                    backend_meeting_id=backend_meeting_id,
                    source_type=source_type,
                    batches=[
                        WorkerFileTranscriptionBatch(
                            sequence_start=1,
                            sequence_end=1,
                            stream_offset_ms=0,
                            duration_ms=total_duration_ms,
                            segments=[],
                            speaker_evidence=[],
                        )
                    ],
                )

            from kapter_ai_worker.utils.alignment import consolidate_segments

            for sequence_index, audio_chunk in enumerate(audio_chunks, start=1):
                normalized_chunk = AudioChunk(
                    index=sequence_index,
                    start_time=audio_chunk.start_time,
                    end_time=audio_chunk.end_time,
                    sample_rate=audio_chunk.sample_rate,
                    samples=normalize_audio(audio_chunk.samples, target_rms=TARGET_RMS),
                    total_chunks=audio_chunk.total_chunks,
                )
                pipeline_result = self._pipeline.process_chunk(
                    normalized_chunk,
                    stream_id=processing_key,
                    registry=meeting_registry,
                )
                final_segments = consolidate_segments(
                    pipeline_result.emitted_segments,
                    registry=meeting_registry,
                )
                speaker_evidence = pipeline_result.speaker_evidence or self._extract_speaker_evidence(
                    normalized_chunk,
                    pipeline_result.speaker_spans,
                    source_type=source_type,
                    registry=meeting_registry,
                )
                response_offset_ms = max(
                    0,
                    int(round(normalized_chunk.start_time * 1000)),
                )
                relative_segments = relativize_segments_to_batch_offset(
                    final_segments,
                    response_offset_ms / 1000.0,
                )
                relative_speaker_evidence = relativize_speaker_evidence_to_batch_offset(
                    speaker_evidence,
                    response_offset_ms / 1000.0,
                )

                worker_batches.append(
                    WorkerFileTranscriptionBatch.from_entities(
                        sequence_start=sequence_index,
                        sequence_end=sequence_index,
                        stream_offset_ms=response_offset_ms,
                        duration_ms=max(
                            1,
                            int(round(normalized_chunk.duration_seconds * 1000)),
                        ),
                        segments=relative_segments,
                        source_type=source_type,
                        speaker_evidence=relative_speaker_evidence,
                    )
                )

            return WorkerFileTranscriptionResponse(
                stream_id=stream_id,
                backend_meeting_id=backend_meeting_id,
                source_type=source_type,
                batches=worker_batches,
            )
        finally:
            clear_processing_buffer_state(self, processing_key)
            self._registry_by_meeting.pop(processing_key, None)
            self._pipeline.clear(stream_id=processing_key)

            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)

    def upsert_voice_profile_cache(
        self,
        *,
        voice_profile_id: str,
        display_name: str,
        is_active: bool,
        embeddings: list[list[float]],
    ) -> None:
        self._voice_profile_cache.upsert_profile(
            voice_profile_id=voice_profile_id,
            display_name=display_name,
            is_active=is_active,
            embeddings=embeddings,
        )

    def delete_voice_profile_cache(self, voice_profile_id: str) -> None:
        self._voice_profile_cache.delete_profile(voice_profile_id)

    def clear_voice_profile_cache(self) -> None:
        self._voice_profile_cache.clear_profiles()

    def _decode_audio_bytes(
        self,
        audio_bytes: bytes,
        mime_type: str,
    ) -> tuple[np.ndarray, int]:
        target_sample_rate = requested_sample_rate(self._settings)
        temporary_path: Path | None = None

        try:
            if is_raw_pcm_mime_type(mime_type):
                return load_raw_pcm_bytes(
                    audio_bytes,
                    mime_type,
                    target_sample_rate=target_sample_rate,
                )

            with NamedTemporaryFile(
                suffix=infer_suffix_from_mime_type(mime_type),
                delete=False,
            ) as temporary_file:
                temporary_file.write(audio_bytes)
                temporary_path = Path(temporary_file.name)

            return load_audio_file(
                temporary_path,
                target_sample_rate=target_sample_rate,
            )
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)

    def _seed_registry_from_cache(
        self,
        registry: SpeakerRegistry,
        known_voice_profile_ids: list[str],
    ) -> None:
        cached_profiles = self._voice_profile_cache.get_profiles_by_ids(
            known_voice_profile_ids,
        )

        for profile in cached_profiles:
            embeddings = [
                np.array(embedding, dtype=np.float32)
                for embedding in profile.embeddings
            ]
            registry.add_known_speaker(
                profile.display_name,
                embeddings,
                voice_profile_id=profile.voice_profile_id,
            )

        logger.info(
            "Seeded registry from local voice cache (profiles={})",
            len(cached_profiles),
        )

    def _analyze_audio_health(
        self,
        samples: np.ndarray,
        sample_rate: int,
    ) -> AudioHealthMetrics:
        speech_frames = self._health_vad.get_speech_segments(samples, sample_rate)
        total_speech_duration = (
            sum(segment[1] - segment[0] for segment in speech_frames) / sample_rate
            if speech_frames
            else 0.0
        )
        duration_seconds = len(samples) / sample_rate if sample_rate > 0 else 0.0
        speech_ratio = (
            total_speech_duration / duration_seconds
            if duration_seconds > 0
            else 0.0
        )
        rms_db = compute_rms_db(samples)
        quality_score = compute_quality_score(
            duration_seconds=total_speech_duration,
            speech_ratio=speech_ratio,
            rms_db=rms_db,
        )

        return AudioHealthMetrics(
            duration_seconds=duration_seconds,
            total_speech_duration=total_speech_duration,
            speech_ratio=speech_ratio,
            rms_db=rms_db,
            quality_score=quality_score,
        )

    def _validate_single_speaker_enrollment(self, audio_chunk: AudioChunk) -> None:
        if not self._settings.use_real_models:
            return

        speaker_spans = self._pipeline._diarizer.diarize(
            audio_chunk,
            registry=None,
            process_duration=audio_chunk.duration_seconds,
        )
        valid_labels = {
            span.speaker_label
            for span in speaker_spans
            if span.speaker_label != "UNKNOWN"
        }

        has_overlap = self._has_overlap(speaker_spans)
        if len(valid_labels) > 1 or has_overlap:
            raise ValueError(
                "Enrollment audio must contain one clear speaker without overlap."
            )

    def _extract_speaker_evidence(
        self,
        audio_chunk: AudioChunk,
        speaker_spans: list[SpeakerSpan],
        *,
        source_type: str | None,
        registry: SpeakerRegistry | None,
    ) -> list[SpeakerEvidence]:
        embedding_model = self._pipeline._diarizer.get_embedding_model()
        if embedding_model is None:
            return []

        evidence_records: list[SpeakerEvidence] = []
        valid_spans = [
            span
            for span in speaker_spans
            if span.speaker_label != "UNKNOWN"
            and (span.end_time - span.start_time) >= MEETING_EVIDENCE_MIN_DURATION_SECONDS
        ]

        for span in valid_spans:
            if self._is_overlap_contaminated(span, speaker_spans):
                continue

            local_start = max(0.0, span.start_time - audio_chunk.start_time)
            local_end = min(
                audio_chunk.duration_seconds,
                span.end_time - audio_chunk.start_time,
            )
            if local_end - local_start < MEETING_EVIDENCE_MIN_DURATION_SECONDS:
                continue

            embedding = embedding_model.get_embedding(audio_chunk, local_start, local_end)
            if embedding is None:
                continue

            segment_samples = self._slice_samples(audio_chunk, local_start, local_end)
            metrics = self._analyze_audio_health(segment_samples, audio_chunk.sample_rate)
            if metrics.quality_score < self._settings.min_voice_profile_quality_score:
                continue

            evidence_records.append(
                SpeakerEvidence(
                    speaker_label=span.speaker_label,
                    start_time=span.start_time,
                    end_time=span.end_time,
                    duration_seconds=span.end_time - span.start_time,
                    embedding=embedding,
                    source_type=source_type,
                    rms_db=metrics.rms_db,
                    speech_ratio=metrics.speech_ratio,
                    quality_score=metrics.quality_score,
                    sample_rate=audio_chunk.sample_rate,
                    voice_profile_id=(
                        registry.get_voice_profile_id(span.speaker_label)
                        if registry
                        else None
                    ),
                )
            )

        return evidence_records

    def _slice_samples(
        self,
        audio_chunk: AudioChunk,
        start_time_local: float,
        end_time_local: float,
    ) -> np.ndarray:
        start_sample = max(0, int(start_time_local * audio_chunk.sample_rate))
        end_sample = min(
            len(audio_chunk.samples),
            int(end_time_local * audio_chunk.sample_rate),
        )
        return audio_chunk.samples[start_sample:end_sample]

    def _has_overlap(self, speaker_spans: list[SpeakerSpan]) -> bool:
        for index, left in enumerate(speaker_spans):
            for right in speaker_spans[index + 1 :]:
                if (
                    min(left.end_time, right.end_time)
                    - max(left.start_time, right.start_time)
                ) > OVERLAP_RISK_SECONDS:
                    return True
        return False

    def _is_overlap_contaminated(
        self,
        current_span: SpeakerSpan,
        speaker_spans: list[SpeakerSpan],
    ) -> bool:
        for span in speaker_spans:
            if span is current_span:
                continue

            overlap = max(
                0.0,
                min(current_span.end_time, span.end_time)
                - max(current_span.start_time, span.start_time),
            )
            if overlap > OVERLAP_RISK_SECONDS:
                return True

        return False

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
                "Created speaker registry for processing key {}",
                processing_key,
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
                "Evicted least-recently-used resources for meeting {}",
                evicted_id,
            )


def requested_sample_rate(settings: WorkerSettings) -> int:
    return settings.expected_sample_rate or 16000
