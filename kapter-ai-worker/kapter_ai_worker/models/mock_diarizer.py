from __future__ import annotations

from kapter_ai_worker.core.base_diarizer import BaseDiarizer
from kapter_ai_worker.core.entities import AudioChunk, SpeakerSpan
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


class MockDiarizer(BaseDiarizer):
    """Deterministic diarizer for testing."""

    def __init__(self, speaker_prefix: str = "SPEAKER") -> None:
        self._speaker_prefix = speaker_prefix

    def diarize(self, audio_chunk: AudioChunk, registry: SpeakerRegistry | None = None) -> list[SpeakerSpan]:
        """Return a single speaker span for the entire chunk."""
        return [
            SpeakerSpan(
                speaker_label=f"{self._speaker_prefix}_00",
                start_time=audio_chunk.start_time,
                end_time=audio_chunk.end_time,
            )
        ]