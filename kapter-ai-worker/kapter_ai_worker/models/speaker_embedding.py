from __future__ import annotations

from pathlib import Path

import torch
import numpy as np
from pyannote.audio import Inference, Model

from kapter_ai_worker.core.entities import AudioChunk
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("SpeakerEmbedding")


class SpeakerEmbedding:
    """Wrapper for pyannote-audio speaker embedding model."""

    def __init__(
        self,
        model_name: str = "pyannote/embedding",
        hf_token: str | None = None,
        device: str = "cuda",
        min_duration: float = 1.5,
    ) -> None:
        self._min_duration = min_duration
        _logger.info(f"Loading embedding model '{model_name}' (device={device})...")
        model = Model.from_pretrained(
            model_name,
            token=hf_token,
        )
        self._inference = Inference(
            model,
            device=torch.device(device),
        )
        _logger.info("Speaker embedding model loaded successfully.")

    def get_embedding(self, audio_chunk: AudioChunk, start_time_local: float, end_time_local: float) -> np.ndarray:
        """
        Extract a speaker embedding from a specific part of an audio chunk.
        
        Args:
            audio_chunk: The audio data.
            start_time_local: Start time relative to chunk start (seconds).
            end_time_local: End time relative to chunk start (seconds).
            
        Returns:
            A 512-dimensional embedding vector as a numpy array, or None if
            the segment is too short to produce a reliable embedding.
        """
        duration = end_time_local - start_time_local
        if duration < self._min_duration:
            _logger.debug(
                f"Segment too short for reliable embedding: {duration:.2f}s "
                f"(min={self._min_duration:.1f}s), skipping"
            )
            return None

        # Calculate sample indices
        start_sample = int(start_time_local * audio_chunk.sample_rate)
        end_sample = int(end_time_local * audio_chunk.sample_rate)
        
        # Ensure we don't go out of bounds
        end_sample = min(end_sample, len(audio_chunk.samples))
        if start_sample >= end_sample:
            return None
            
        samples = audio_chunk.samples[start_sample:end_sample]
        
        # Inference expects a dict with waveform and sample_rate
        # Waveform must be (channels, samples)
        waveform = torch.from_numpy(samples).unsqueeze(0)
        audio_data = {"waveform": waveform, "sample_rate": audio_chunk.sample_rate}
        
        # Get embedding result (SlidingWindowFeature)
        feature = self._inference(audio_data)
        
        # Convert to numpy and average across time if multiple windows were returned
        # feature.data is usually (Time, EmbeddingSize)
        embedding = np.mean(feature.data, axis=0).astype(np.float32)

        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding /= norm

        return embedding
