from __future__ import annotations

from abc import ABC, abstractmethod

from kapter_ai_worker.core.entities import AudioChunk, TranscriptSpan


class BaseASR(ABC):
    """Contract for speech-to-text engines used by the pipeline."""

    @abstractmethod
    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None) -> list[TranscriptSpan]:
        """Transcribe an audio chunk and return spans with absolute timestamps."""