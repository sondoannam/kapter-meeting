from __future__ import annotations

from kapter_ai_worker.core.base_asr import BaseASR
from kapter_ai_worker.core.entities import AudioChunk, TranscriptSpan


class MockASR(BaseASR):
    """Deterministic ASR for testing without real model overhead."""

    def transcribe(self, audio_chunk: AudioChunk) -> list[TranscriptSpan]:
        """Return a single fixed transcript segment for any audio."""
        return [
            TranscriptSpan(
                text="This is a mock transcript from the Kapter AI worker.",
                start_time=audio_chunk.start_time,
                end_time=audio_chunk.end_time,
                confidence=1.0,
            )
        ]