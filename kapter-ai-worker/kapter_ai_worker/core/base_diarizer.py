from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry

if TYPE_CHECKING:
    from kapter_ai_worker.models.speaker_embedding import SpeakerEmbedding


class BaseDiarizer(ABC):
    """Contract for speaker diarization engines used by the pipeline."""

    @abstractmethod
    def diarize(self, audio_chunk: AudioChunk, registry: SpeakerRegistry | None = None, process_duration: float | None = None) -> list[SpeakerSpan]:
        """Return speaker spans with absolute timestamps for the source file."""

    @abstractmethod
    def get_embedding_model(self) -> SpeakerEmbedding | None:
        """Return the internal embedding model for standalone extraction."""