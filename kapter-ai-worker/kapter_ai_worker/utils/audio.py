from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio

from kapter_ai_worker.core.entities import AudioChunk
from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("audio_utils")


def is_raw_pcm_mime_type(mime_type: str) -> bool:
    normalized_mime_type = mime_type.split(";", maxsplit=1)[0].strip().lower()

    return normalized_mime_type in {"audio/pcm", "audio/raw"}


def load_raw_pcm_bytes(
    audio_bytes: bytes,
    mime_type: str,
    target_sample_rate: int = 16000,
) -> tuple[np.ndarray, int]:
    parameters = _parse_mime_type_parameters(mime_type)
    encoding = parameters.get("encoding", parameters.get("format", "s16le")).lower()

    if encoding not in {"s16le", "pcm_s16le"}:
        raise ValueError(f"Unsupported PCM encoding '{encoding}'.")

    sample_rate = int(parameters.get("rate", target_sample_rate))
    channel_count = int(parameters.get("channels", 1))

    if sample_rate <= 0:
        raise ValueError("PCM sample rate must be greater than zero.")

    if channel_count <= 0:
        raise ValueError("PCM channel count must be greater than zero.")

    if len(audio_bytes) % 2 != 0:
        raise ValueError("PCM s16le payload byte length must be even.")

    samples = np.frombuffer(audio_bytes, dtype="<i2").astype(np.float32)

    if channel_count > 1:
        if samples.size % channel_count != 0:
            raise ValueError(
                "PCM payload sample count is not divisible by the declared channel count."
            )

        samples = samples.reshape(-1, channel_count).mean(axis=1, dtype=np.float32)

    mono_samples = np.ascontiguousarray(samples / 32768.0, dtype=np.float32)

    return _normalize_sample_rate(mono_samples, sample_rate, target_sample_rate)


def _parse_mime_type_parameters(mime_type: str) -> dict[str, str]:
    parameters: dict[str, str] = {}

    for parameter in mime_type.split(";")[1:]:
        key, separator, value = parameter.partition("=")

        if separator != "=":
            continue

        normalized_key = key.strip().lower()
        normalized_value = value.strip().lower()

        if normalized_key and normalized_value:
            parameters[normalized_key] = normalized_value

    return parameters


def load_audio_file(
    file_path: Path, target_sample_rate: int = 16000
) -> tuple[np.ndarray, int]:
    """Read audio and normalize it to mono float32 samples at target_sample_rate."""

    if file_path.suffix.lower() == ".wav":
        try:
            samples, sr = _load_wav_with_soundfile(file_path, target_sample_rate)
            _logger.debug(f"Loaded {file_path.name} using soundfile: {len(samples)} samples, RMS={np.sqrt(np.mean(samples**2)):.6f}")
            return samples, sr
        except RuntimeError:
            pass

    samples, sr = _load_audio_with_torchaudio(file_path, target_sample_rate)
    _logger.debug(f"Loaded {file_path.name} using torchaudio: {len(samples)} samples, RMS={np.sqrt(np.mean(samples**2)):.6f}")
    return samples, sr


def _load_wav_with_soundfile(
    file_path: Path,
    target_sample_rate: int,
) -> tuple[np.ndarray, int]:
    samples, sample_rate = sf.read(file_path, dtype="float32", always_2d=True)
    mono_samples = np.mean(samples, axis=1, dtype=np.float32)

    return _normalize_sample_rate(mono_samples, sample_rate, target_sample_rate)


def _load_audio_with_torchaudio(
    file_path: Path,
    target_sample_rate: int,
) -> tuple[np.ndarray, int]:
    waveform, sample_rate = torchaudio.load(str(file_path))
    mono_samples = waveform.float().mean(dim=0).numpy()

    return _normalize_sample_rate(mono_samples, sample_rate, target_sample_rate)


def _normalize_sample_rate(
    mono_samples: np.ndarray,
    sample_rate: int,
    target_sample_rate: int,
) -> tuple[np.ndarray, int]:
    contiguous_samples = np.ascontiguousarray(mono_samples, dtype=np.float32)

    if sample_rate != target_sample_rate:
        waveform = torch.from_numpy(contiguous_samples).unsqueeze(0)
        resampled_waveform = torchaudio.functional.resample(
            waveform, sample_rate, target_sample_rate
        )
        contiguous_samples = resampled_waveform.squeeze().numpy()
        sample_rate = target_sample_rate

    return np.ascontiguousarray(contiguous_samples, dtype=np.float32), sample_rate


def generate_vad_audio_chunks(
    file_path: Path,
    vad: BaseVoiceActivityDetector,
    expected_sample_rate: int | None = None,
    chunk_duration_seconds: float = 25.0,
    overlap_duration_seconds: float = 5.0,
) -> Iterator[AudioChunk]:
    """
    Yield dynamic-size chunks based on VAD segmentation.
    Supports overlapping chunks to improve diarization stability across boundaries.
    """

    samples, sample_rate = load_audio_file(file_path)
    if expected_sample_rate is not None and sample_rate != expected_sample_rate:
        raise ValueError(
            f"Expected sample rate {expected_sample_rate}, received {sample_rate} for {file_path.name}."
        )

    speech_segments = vad.get_speech_segments(samples, sample_rate)

    if not speech_segments:
        return

    # Convert durations to samples
    max_chunk_samples = int(chunk_duration_seconds * sample_rate)
    overlap_samples = int(overlap_duration_seconds * sample_rate)

    grouped_chunks = []
    
    # Simple grouping with overlap
    i = 0
    while i < len(speech_segments):
        chunk_start_sample = speech_segments[i][0]
        chunk_end_sample = speech_segments[i][1]
        
        # Add subsequent segments until max duration is reached
        j = i + 1
        while j < len(speech_segments):
            next_start, next_end = speech_segments[j]
            if (next_end - chunk_start_sample) > max_chunk_samples:
                break
            chunk_end_sample = next_end
            j += 1
        
        grouped_chunks.append((chunk_start_sample, chunk_end_sample))
        
        # If we reached the end of all segments, stop
        if j >= len(speech_segments):
            break
            
        # To handle overlap: find the new starting segment for the NEXT chunk
        # It should be the first segment that starts AFTER (chunk_end_sample - overlap_samples)
        target_next_start = chunk_end_sample - overlap_samples
        
        next_i = j
        # Look backwards from j to find a good overlapping start point
        for k in range(j - 1, i, -1):
            if speech_segments[k][0] <= target_next_start:
                # We found a segment that starts before or at the target
                # The next chunk will start from here to ensure overlap
                next_i = k
                break
        
        # Safety: ensure we always move forward in segments to avoid infinite loops
        if next_i <= i:
            i = i + 1
        else:
            i = next_i

    total_chunks = len(grouped_chunks)

    for chunk_index, (start_sample, end_sample) in enumerate(grouped_chunks):
        yield AudioChunk(
            index=chunk_index,
            start_time=start_sample / sample_rate,
            end_time=end_sample / sample_rate,
            sample_rate=sample_rate,
            samples=samples[start_sample:end_sample].copy(),
            total_chunks=total_chunks,
        )