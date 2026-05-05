from __future__ import annotations

import numpy as np

from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan, TranscriptSpan
from kapter_ai_worker.pipeline.streaming_pipeline import StreamingInferencePipeline


class DummyAsr:
    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None):
        return [
            TranscriptSpan(
                text="recorder speech",
                start_time=audio_chunk.start_time + 0.1,
                end_time=audio_chunk.start_time + 0.6,
                confidence=0.95,
            )
        ]


class FailingDiarizer:
    def diarize(self, audio_chunk: AudioChunk, registry=None, process_duration=None):
        raise AssertionError("self_mic ASR-only path should not call diarization")


def test_process_chunk_skips_diarization_when_authoritative_label_is_present() -> None:
    pipeline = StreamingInferencePipeline(
        asr=DummyAsr(),
        diarizer=FailingDiarizer(),
    )

    result = pipeline.process_chunk(
        AudioChunk(
            index=0,
            start_time=5.0,
            end_time=6.0,
            sample_rate=16000,
            samples=np.zeros(16000, dtype=np.float32),
            total_chunks=1,
        ),
        stream_id="meeting_same:self_mic",
        authoritative_speaker_label="RECORDER",
    )

    assert result.speaker_spans == []
    assert len(result.emitted_segments) == 1
    assert result.emitted_segments[0].speaker_label == "RECORDER"
    assert result.emitted_segments[0].text == "recorder speech"
