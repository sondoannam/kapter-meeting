from __future__ import annotations

import base64

import numpy as np
import pytest

from kapter_ai_worker.config.settings import WorkerSettings
from kapter_ai_worker.contracts.worker_contracts import WorkerAudioBatchRequest
from kapter_ai_worker.core.entities import (
    DiarizedTranscriptSegment,
    PipelineChunkResult,
)
from kapter_ai_worker.services.audio_batch_processor import AudioBatchProcessor
from kapter_ai_worker.services.voice_profile_cache import VoiceProfileCache


def build_pcm_s16le_bytes(
    sample_rate: int = 16000,
    seconds: float = 1.0,
) -> bytes:
    return b"\x00\x00" * int(sample_rate * seconds)


def build_constant_pcm_s16le_bytes(
    amplitude: float,
    *,
    sample_rate: int = 16000,
    seconds: float = 1.0,
) -> bytes:
    samples = np.full(int(sample_rate * seconds), amplitude, dtype=np.float32)
    pcm = np.clip(samples, -1.0, 1.0)
    return (pcm * np.iinfo(np.int16).max).astype(np.int16).tobytes()


class DummyPipeline:
    def __init__(self) -> None:
        self.chunk_start_times: list[float] = []
        self.registry_ids: list[int] = []
        self.stream_ids: list[str | None] = []
        self.authoritative_labels: list[str | None] = []
        self.seeded_speaker_ids: list[list[str]] = []
        self.chunk_samples: list[np.ndarray] = []
        self._diarizer = type(
            "DummyDiarizer",
            (),
            {
                "get_embedding_model": staticmethod(lambda: None),
            },
        )()

    def clear(self, *, stream_id=None) -> None:
        return None

    def process_chunk(
        self,
        audio_chunk,
        *,
        stream_id=None,
        registry=None,
        authoritative_speaker_label=None,
    ) -> PipelineChunkResult:
        self.chunk_start_times.append(audio_chunk.start_time)
        self.registry_ids.append(id(registry))
        self.stream_ids.append(stream_id)
        self.authoritative_labels.append(authoritative_speaker_label)
        self.seeded_speaker_ids.append(sorted(registry._speakers.keys()))
        self.chunk_samples.append(audio_chunk.samples.copy())

        return PipelineChunkResult(
            audio_chunk=audio_chunk,
            emitted_segments=[
                DiarizedTranscriptSegment(
                    speaker_label=authoritative_speaker_label or "PERSON_0",
                    text="hello",
                    start_time=audio_chunk.start_time + 0.25,
                    end_time=audio_chunk.start_time + 0.75,
                    confidence=0.92,
                )
            ],
        )


def create_processor(
    pipeline: DummyPipeline,
    tmp_path,
    *,
    chunk_duration_seconds: float = 1.0,
    overlap_duration_seconds: float = 0.0,
) -> AudioBatchProcessor:
    return AudioBatchProcessor(
        settings=WorkerSettings(
            use_real_models=False,
            device="cpu",
            real_model_chunk_duration_seconds=chunk_duration_seconds,
            real_model_overlap_duration_seconds=overlap_duration_seconds,
            speaker_match_threshold=0.5,
        ),
        pipeline=pipeline,
        voice_profile_cache=VoiceProfileCache(tmp_path / "voice_profile_cache.json"),
    )


class NegativeEpsilonStartPipeline(DummyPipeline):
    def process_chunk(
        self,
        audio_chunk,
        *,
        stream_id=None,
        registry=None,
        authoritative_speaker_label=None,
    ) -> PipelineChunkResult:
        self.chunk_start_times.append(audio_chunk.start_time)
        self.registry_ids.append(id(registry))
        self.stream_ids.append(stream_id)
        self.authoritative_labels.append(authoritative_speaker_label)

        return PipelineChunkResult(
            audio_chunk=audio_chunk,
            emitted_segments=[
                DiarizedTranscriptSegment(
                    speaker_label=authoritative_speaker_label or "PERSON_0",
                    text="hello",
                    start_time=-5.684341886080802e-14,
                    end_time=0.75,
                    confidence=0.92,
                )
            ],
        )


def test_process_request_uses_absolute_batch_offset_and_returns_relative_segments(
    tmp_path,
) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(pipeline, tmp_path)

    response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_1",
            backend_meeting_id="meeting_1",
            sequence_start=4,
            sequence_end=8,
            stream_offset_ms=12_000,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
        )
    )

    assert pipeline.chunk_start_times == [12.0]
    assert response.segments[0].start_time == 0.25
    assert response.segments[0].end_time == 0.75


def test_process_request_clamps_negative_epsilon_segment_start_time(tmp_path) -> None:
    pipeline = NegativeEpsilonStartPipeline()
    processor = create_processor(pipeline, tmp_path)

    response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_1",
            backend_meeting_id="meeting_1",
            sequence_start=4,
            sequence_end=8,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
        )
    )

    assert response.segments[0].start_time == 0.0
    assert response.segments[0].end_time == 0.75


def test_process_request_scopes_speaker_registry_per_meeting(tmp_path) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(pipeline, tmp_path)

    requests = [
        WorkerAudioBatchRequest(
            stream_id="stream_a",
            backend_meeting_id="meeting_same",
            sequence_start=1,
            sequence_end=1,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
        ),
        WorkerAudioBatchRequest(
            stream_id="stream_a",
            backend_meeting_id="meeting_same",
            sequence_start=2,
            sequence_end=2,
            stream_offset_ms=1_000,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
        ),
        WorkerAudioBatchRequest(
            stream_id="stream_b",
            backend_meeting_id="meeting_other",
            sequence_start=1,
            sequence_end=1,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
        ),
    ]

    for request in requests:
        processor.process_request(request)

    assert pipeline.registry_ids[0] == pipeline.registry_ids[1]
    assert pipeline.registry_ids[1] != pipeline.registry_ids[2]


def test_process_request_isolates_self_mic_lane_and_applies_recorder_label(
    tmp_path,
) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(pipeline, tmp_path)

    processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=0,
            sequence_end=0,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
            source_type="tab_mix",
        )
    )

    response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_mic",
            backend_meeting_id="meeting_same",
            sequence_start=0,
            sequence_end=0,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
            capture_context="google_meet_room",
            source_type="self_mic",
            authoritative_speaker_label="RECORDER",
        )
    )

    assert pipeline.stream_ids == ["meeting_same", "meeting_same:self_mic"]
    assert pipeline.chunk_start_times == [0.0, 0.0]
    assert pipeline.registry_ids[0] != pipeline.registry_ids[1]
    assert pipeline.authoritative_labels == [None, "RECORDER"]
    assert response.segments[0].ai_label == "RECORDER"


def test_process_request_ignores_self_mic_outside_google_meet_context(
    tmp_path,
) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(pipeline, tmp_path)

    response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_mic",
            backend_meeting_id="meeting_same",
            sequence_start=1,
            sequence_end=1,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
            capture_context="generic_tab",
            source_type="self_mic",
            authoritative_speaker_label="RECORDER",
        )
    )

    assert pipeline.stream_ids == []
    assert pipeline.chunk_start_times == []
    assert response.source_type == "self_mic"
    assert response.segments == []


def test_tab_mix_buffered_window_uses_window_start_as_response_offset(
    tmp_path,
) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(
        pipeline,
        tmp_path,
        chunk_duration_seconds=30.0,
        overlap_duration_seconds=20.0,
    )

    first_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=1,
            sequence_end=5,
            stream_offset_ms=0,
            duration_ms=10_240,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes(seconds=10.24)).decode(
                "ascii"
            ),
            source_type="tab_mix",
        )
    )
    second_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=6,
            sequence_end=10,
            stream_offset_ms=10_240,
            duration_ms=10_240,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes(seconds=10.24)).decode(
                "ascii"
            ),
            source_type="tab_mix",
        )
    )
    third_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=11,
            sequence_end=15,
            stream_offset_ms=20_480,
            duration_ms=10_240,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes(seconds=10.24)).decode(
                "ascii"
            ),
            source_type="tab_mix",
        )
    )

    assert first_response.segments == []
    assert second_response.segments == []
    assert pipeline.chunk_start_times == [0.0]
    assert third_response.stream_offset_ms == 0
    assert third_response.segments[0].start_time == 0.25
    assert third_response.segments[0].end_time == 0.75


def test_self_mic_batches_bypass_long_sliding_window_and_stay_batch_relative(
    tmp_path,
) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(
        pipeline,
        tmp_path,
        chunk_duration_seconds=30.0,
        overlap_duration_seconds=20.0,
    )

    first_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_mic",
            backend_meeting_id="meeting_same",
            sequence_start=1,
            sequence_end=5,
            stream_offset_ms=0,
            duration_ms=10_240,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes(seconds=10.24)).decode(
                "ascii"
            ),
            capture_context="google_meet_room",
            source_type="self_mic",
            authoritative_speaker_label="RECORDER",
        )
    )

    second_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_mic",
            backend_meeting_id="meeting_same",
            sequence_start=6,
            sequence_end=10,
            stream_offset_ms=10_240,
            duration_ms=10_240,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes(seconds=10.24)).decode(
                "ascii"
            ),
            capture_context="google_meet_room",
            source_type="self_mic",
            authoritative_speaker_label="RECORDER",
        )
    )

    assert pipeline.chunk_start_times == [0.0, 10.24]
    assert first_response.segments[0].start_time == 0.25
    assert second_response.segments[0].start_time == 0.25
    assert second_response.segments[0].end_time == 0.75


def test_process_request_seeds_known_voice_profiles_from_local_cache(tmp_path) -> None:
    pipeline = DummyPipeline()
    cache = VoiceProfileCache(tmp_path / "voice_profile_cache.json")
    cache.upsert_profile(
        voice_profile_id="vp_1",
        display_name="Alice Nguyen",
        is_active=True,
        embeddings=[[1.0, 0.0, 0.0]],
    )
    processor = AudioBatchProcessor(
        settings=WorkerSettings(
            use_real_models=False,
            device="cpu",
            real_model_chunk_duration_seconds=1.0,
            real_model_overlap_duration_seconds=0.0,
            speaker_match_threshold=0.5,
        ),
        pipeline=pipeline,
        voice_profile_cache=cache,
    )

    processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_1",
            backend_meeting_id="meeting_1",
            sequence_start=1,
            sequence_end=1,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(build_pcm_s16le_bytes()).decode("ascii"),
            known_voice_profile_ids=["vp_1"],
        )
    )

    assert pipeline.seeded_speaker_ids == [["Alice Nguyen"]]


def test_tab_mix_window_is_normalized_once_after_buffering(tmp_path) -> None:
    pipeline = DummyPipeline()
    processor = create_processor(
        pipeline,
        tmp_path,
        chunk_duration_seconds=2.0,
        overlap_duration_seconds=0.0,
    )

    first_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=1,
            sequence_end=1,
            stream_offset_ms=0,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(
                build_constant_pcm_s16le_bytes(0.1),
            ).decode("ascii"),
            source_type="tab_mix",
        )
    )
    second_response = processor.process_request(
        WorkerAudioBatchRequest(
            stream_id="stream_tab",
            backend_meeting_id="meeting_same",
            sequence_start=2,
            sequence_end=2,
            stream_offset_ms=1_000,
            duration_ms=1_000,
            mime_type="audio/pcm;rate=16000;channels=1;encoding=s16le",
            audio_base64=base64.b64encode(
                build_constant_pcm_s16le_bytes(0.4),
            ).decode("ascii"),
            source_type="tab_mix",
        )
    )

    assert first_response.segments == []
    assert second_response.segments[0].start_time == 0.25
    assert len(pipeline.chunk_samples) == 1

    emitted_samples = pipeline.chunk_samples[0]
    half_index = emitted_samples.shape[0] // 2
    first_half_peak = float(np.max(np.abs(emitted_samples[:half_index])))
    second_half_peak = float(np.max(np.abs(emitted_samples[half_index:])))

    assert second_half_peak > first_half_peak
    assert first_half_peak / second_half_peak == pytest.approx(0.25, rel=0.1)
