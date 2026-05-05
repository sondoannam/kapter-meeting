from __future__ import annotations

from abc import ABC, abstractmethod

from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


class BaseDiarizer(ABC):
    """Contract for speaker diarization engines used by the pipeline."""

    @abstractmethod
    def diarize(self, audio_chunk: AudioChunk, registry: SpeakerRegistry | None = None, process_duration: float | None = None) -> list[SpeakerSpan]:
        """Return speaker spans with absolute timestamps for the source file."""