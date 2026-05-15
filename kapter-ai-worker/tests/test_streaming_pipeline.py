from __future__ import annotations

import numpy as np

from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan, TranscriptSpan
from kapter_ai_worker.core.entities import DiarizedTranscriptSegment
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


class EmptyDiarizer:
    def diarize(self, audio_chunk: AudioChunk, registry=None, process_duration=None):
        return [
            SpeakerSpan(
                speaker_label="UNKNOWN",
                start_time=audio_chunk.start_time,
                end_time=audio_chunk.end_time,
            )
        ]


class SplitSentenceAsr:
    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None):
        base = audio_chunk.start_time
        return [
            TranscriptSpan(text="How", start_time=base + 0.72, end_time=base + 1.24, confidence=0.96, source_segment_index=0),
            TranscriptSpan(text="do", start_time=base + 1.24, end_time=base + 1.32, confidence=0.98, source_segment_index=0),
            TranscriptSpan(text="people", start_time=base + 1.32, end_time=base + 1.54, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="feel", start_time=base + 1.54, end_time=base + 1.74, confidence=1.0, source_segment_index=0),
            TranscriptSpan(text="about", start_time=base + 1.74, end_time=base + 1.92, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="that", start_time=base + 1.92, end_time=base + 2.08, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="proposal?", start_time=base + 2.08, end_time=base + 2.54, confidence=0.98, source_segment_index=0),
        ]


class TwoSegmentAsr:
    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None):
        base = audio_chunk.start_time
        return [
            TranscriptSpan(text="How", start_time=base + 0.72, end_time=base + 1.24, confidence=0.96, source_segment_index=0),
            TranscriptSpan(text="do", start_time=base + 1.24, end_time=base + 1.32, confidence=0.98, source_segment_index=0),
            TranscriptSpan(text="people", start_time=base + 1.32, end_time=base + 1.54, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="feel", start_time=base + 1.54, end_time=base + 1.74, confidence=1.0, source_segment_index=0),
            TranscriptSpan(text="about", start_time=base + 1.74, end_time=base + 1.92, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="that", start_time=base + 1.92, end_time=base + 2.08, confidence=0.99, source_segment_index=0),
            TranscriptSpan(text="proposal?", start_time=base + 2.08, end_time=base + 2.54, confidence=0.98, source_segment_index=0),
            TranscriptSpan(text="I", start_time=base + 2.62, end_time=base + 2.76, confidence=0.98, source_segment_index=1),
            TranscriptSpan(text="think", start_time=base + 2.76, end_time=base + 3.10, confidence=0.97, source_segment_index=1),
            TranscriptSpan(text="so.", start_time=base + 3.10, end_time=base + 3.44, confidence=0.97, source_segment_index=1),
        ]


class GapDiarizer:
    def diarize(self, audio_chunk: AudioChunk, registry=None, process_duration=None):
        base = audio_chunk.start_time
        return [
            SpeakerSpan(speaker_label="P1", start_time=base - 2.53, end_time=base + 0.04),
            SpeakerSpan(speaker_label="UNKNOWN", start_time=base + 1.11, end_time=base + 2.82),
            SpeakerSpan(speaker_label="P2", start_time=base + 4.69, end_time=base + 12.10),
        ]


class AmbiguousOverlapDiarizer:
    def diarize(self, audio_chunk: AudioChunk, registry=None, process_duration=None):
        base = audio_chunk.start_time
        return [
            SpeakerSpan(speaker_label="P1", start_time=base + 0.60, end_time=base + 1.90),
            SpeakerSpan(speaker_label="P2", start_time=base + 1.20, end_time=base + 2.60),
            SpeakerSpan(speaker_label="UNKNOWN", start_time=base + 1.00, end_time=base + 2.40),
        ]


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


def test_process_chunk_keeps_unknown_when_no_valid_speaker_spans_exist() -> None:
    pipeline = StreamingInferencePipeline(
        asr=DummyAsr(),
        diarizer=EmptyDiarizer(),
    )

    result = pipeline.process_chunk(
        AudioChunk(
            index=0,
            start_time=10.0,
            end_time=11.0,
            sample_rate=16000,
            samples=np.zeros(16000, dtype=np.float32),
            total_chunks=1,
        ),
        stream_id="meeting_same",
    )

    assert len(result.emitted_segments) == 1
    assert result.emitted_segments[0].speaker_label == "UNKNOWN"


def test_process_chunk_keeps_single_unknown_phrase_across_unknown_gap() -> None:
    pipeline = StreamingInferencePipeline(
        asr=SplitSentenceAsr(),
        diarizer=GapDiarizer(),
    )

    result = pipeline.process_chunk(
        AudioChunk(
            index=0,
            start_time=64.0,
            end_time=74.0,
            sample_rate=16000,
            samples=np.zeros(160000, dtype=np.float32),
            total_chunks=1,
        ),
        stream_id="meeting_same",
    )

    assert len(result.emitted_segments) == 1
    assert result.emitted_segments[0].speaker_label == "UNKNOWN"
    assert result.emitted_segments[0].text == "How do people feel about that proposal?"


def test_process_chunk_abstains_when_phrase_overlaps_multiple_speakers_and_unknown() -> None:
    pipeline = StreamingInferencePipeline(
        asr=SplitSentenceAsr(),
        diarizer=AmbiguousOverlapDiarizer(),
    )

    result = pipeline.process_chunk(
        AudioChunk(
            index=0,
            start_time=64.0,
            end_time=74.0,
            sample_rate=16000,
            samples=np.zeros(160000, dtype=np.float32),
            total_chunks=1,
        ),
        stream_id="meeting_same",
    )

    assert len(result.emitted_segments) == 1
    assert result.emitted_segments[0].speaker_label == "UNKNOWN"


def test_process_chunk_keeps_asr_segment_boundary_for_same_speaker() -> None:
    class SingleSpeakerDiarizer:
        def diarize(self, audio_chunk: AudioChunk, registry=None, process_duration=None):
            return [
                SpeakerSpan(
                    speaker_label="P1",
                    start_time=audio_chunk.start_time,
                    end_time=audio_chunk.end_time,
                )
            ]

    pipeline = StreamingInferencePipeline(
        asr=TwoSegmentAsr(),
        diarizer=SingleSpeakerDiarizer(),
    )

    result = pipeline.process_chunk(
        AudioChunk(
            index=0,
            start_time=64.0,
            end_time=74.0,
            sample_rate=16000,
            samples=np.zeros(160000, dtype=np.float32),
            total_chunks=1,
        ),
        stream_id="meeting_same",
    )

    assert [segment.speaker_label for segment in result.emitted_segments] == ["P1", "P1"]
    assert [segment.text for segment in result.emitted_segments] == [
        "How do people feel about that proposal?",
        "I think so.",
    ]


def test_group_transcript_spans_does_not_split_long_same_asr_segment() -> None:
    pipeline = StreamingInferencePipeline(
        asr=DummyAsr(),
        diarizer=EmptyDiarizer(),
    )

    spans = [
        TranscriptSpan(
            text="This",
            start_time=0.0,
            end_time=4.0,
            confidence=0.9,
            source_segment_index=0,
        ),
        TranscriptSpan(
            text="is",
            start_time=4.05,
            end_time=8.2,
            confidence=0.9,
            source_segment_index=0,
        ),
        TranscriptSpan(
            text="one",
            start_time=8.25,
            end_time=12.6,
            confidence=0.9,
            source_segment_index=0,
        ),
        TranscriptSpan(
            text="coherent segment.",
            start_time=12.65,
            end_time=16.9,
            confidence=0.9,
            source_segment_index=0,
        ),
    ]

    grouped = pipeline._group_transcript_spans(spans)

    assert len(grouped) == 1
    assert grouped[0].text == "This is one coherent segment."


def test_repair_cross_speaker_sentence_boundary_moves_dangling_word_prefix() -> None:
    previous_segment = DiarizedTranscriptSegment(
        speaker_label="UNKNOWN",
        text="you propose this I don't I could see either way so let's stick with the",
        start_time=0.0,
        end_time=4.0,
    )
    current_segment = DiarizedTranscriptSegment(
        speaker_label="P1",
        text="proposal cool we'll try it and we'll we can be flexible",
        start_time=4.2,
        end_time=8.2,
    )

    StreamingInferencePipeline._repair_cross_speaker_sentence_boundary(
        previous_segment,
        current_segment,
    )

    assert previous_segment.text.endswith("the proposal")
    assert current_segment.text == "cool we'll try it and we'll we can be flexible"


def test_repair_cross_speaker_sentence_boundary_supports_vietnamese_function_words() -> None:
    previous_segment = DiarizedTranscriptSegment(
        speaker_label="UNKNOWN",
        text="chung ta se giu nguyen de xuat nay cho",
        start_time=0.0,
        end_time=3.5,
    )
    current_segment = DiarizedTranscriptSegment(
        speaker_label="P1",
        text="nhom phat trien truoc roi minh xem tiep",
        start_time=3.6,
        end_time=7.6,
    )

    StreamingInferencePipeline._repair_cross_speaker_sentence_boundary(
        previous_segment,
        current_segment,
    )

    assert previous_segment.text.endswith("cho nhom")
    assert current_segment.text == "phat trien truoc roi minh xem tiep"
