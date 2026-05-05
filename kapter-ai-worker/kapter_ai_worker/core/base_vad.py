from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class BaseVoiceActivityDetector(ABC):
    """Contract for optional VAD gating before ASR and diarization."""



    @abstractmethod
    def get_speech_segments(self, samples: np.ndarray, sample_rate: int) -> list[tuple[int, int]]:
        """Return a list of (start_sample, end_sample) for speech segments based on VAD."""

    def reset_states(self) -> None:
        """Reset internal VAD states (e.g. RNN/LSTM hidden states) if any."""
        pass