from __future__ import annotations

import numpy as np
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("SileroVAD")


class SileroVAD(BaseVoiceActivityDetector):
    """Voice activity detection using the Silero VAD model."""

    def __init__(self, threshold: float = 0.5) -> None:
        _logger.info("Loading Silero VAD model...")
        self._model = load_silero_vad()
        self._threshold = threshold
        _logger.info("Silero VAD model loaded successfully.")



    def get_speech_segments(self, samples: np.ndarray, sample_rate: int) -> list[tuple[int, int]]:
        """Return speech segments as (start_sample, end_sample) pairs."""
        if samples.size == 0:
            return []

        waveform = torch.from_numpy(samples).float()

        speech_timestamps = get_speech_timestamps(
            waveform,
            self._model,
            sampling_rate=sample_rate,
            threshold=self._threshold,
            return_seconds=False,
        )

        return [(ts["start"], ts["end"]) for ts in speech_timestamps]
    
    def reset_states(self) -> None:
        """Reset internal Silero VAD states."""
        if hasattr(self._model, 'reset_states'):
            self._model.reset_states()
            _logger.info("Silero VAD states reset.")
        else:
            _logger.debug("Silero VAD model does not support reset_states.")