from __future__ import annotations

from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
import numpy as np


class MockVoiceActivityDetector(BaseVoiceActivityDetector):
    """Deterministic VAD for testing."""

    def __init__(self, energy_threshold: float = 0.5) -> None:
        self._energy_threshold = energy_threshold



    def get_speech_segments(self, samples: np.ndarray, sample_rate: int) -> list[tuple[int, int]]:
        """Mock behavior: entire audio is one segment of speech."""
        return [(0, len(samples))]