from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(slots=True)
class AudioChunk:
    """A chunk of audio represented with file-relative timestamps."""

    index: int
    start_time: float
    end_time: float
    sample_rate: int
    samples: np.ndarray
    total_chunks: int

    @property
    def duration_seconds(self) -> float:
        return self.end_time - self.start_time


@dataclass(slots=True)
class TranscriptSpan:
    """ASR output span using absolute timestamps relative to the source file."""

    text: str
    start_time: float
    end_time: float
    confidence: float | None = None
    source_segment_index: int | None = None
    group_index: int | None = None


@dataclass(slots=True)
class SpeakerSpan:
    """Diarization output span using absolute timestamps relative to the source file."""

    speaker_label: str
    start_time: float
    end_time: float
    confidence: float | None = None


@dataclass(slots=True)
class DiarizedTranscriptSegment:
    """Aligned transcript segment with a speaker assignment."""

    speaker_label: str
    text: str
    start_time: float
    end_time: float
    confidence: float | None = None
    voice_profile_id: str | None = None
    source_segment_index: int | None = None
    source_group_index: int | None = None


@dataclass(slots=True)
class SpeakerEvidence:
    """Enrollment-quality speaker sample extracted during diarization."""

    speaker_label: str
    start_time: float
    end_time: float
    duration_seconds: float
    embedding: np.ndarray
    source_type: str | None = None
    rms_db: float | None = None
    speech_ratio: float | None = None
    quality_score: float | None = None
    sample_rate: int | None = None
    voice_profile_id: str | None = None


@dataclass(slots=True)
class PipelineChunkResult:
    """Pipeline result for a single audio chunk."""

    audio_chunk: AudioChunk
    transcript_spans: list[TranscriptSpan] = field(default_factory=list)
    speaker_spans: list[SpeakerSpan] = field(default_factory=list)
    emitted_segments: list[DiarizedTranscriptSegment] = field(default_factory=list)
    speaker_evidence: list[SpeakerEvidence] = field(default_factory=list)
    skipped: bool = False
    skip_reason: str | None = None
