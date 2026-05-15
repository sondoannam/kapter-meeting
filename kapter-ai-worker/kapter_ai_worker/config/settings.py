from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    """Runtime settings for local chunk processing and model selection."""

    app_name: str = "kapter-ai-worker"
    chunk_duration_seconds: float = Field(default=2.0, gt=0.0)
    overlap_duration_seconds: float = Field(default=0.0, ge=0.0)
    stream_delay_ratio: float = Field(default=0.0, ge=0.0)
    expected_sample_rate: int | None = Field(default=None, ge=1)
    vad_energy_threshold: float = Field(default=0.003, ge=0.0)
    default_speaker_prefix: str = "SPEAKER"
    log_level: str = "INFO"
    ffmpeg_bin_dir: Path | None = None
    voice_profile_cache_path: Path = Path("voice_profile_cache.json")

    # --- Real model settings ---
    use_real_models: bool = True
    device: str = "cuda"
    hf_token: str | None = None
    language: str | None = None
    shared_secret: str | None = None

    @field_validator(
        "expected_sample_rate",
        "hf_token",
        "ffmpeg_bin_dir",
        "faster_whisper_model_dir",
        "pyannote_model_dir",
        "language",
        "shared_secret",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none(cls, v):
        """Convert empty strings from .env files to None."""
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    # Faster Whisper
    faster_whisper_model_name: str = "large-v3-turbo"
    faster_whisper_model_dir: Path | None = None
    faster_whisper_compute_type: str = "int8_float16"
    faster_whisper_beam_size: int = 5

    # Pyannote
    pyannote_model_name: str = "pyannote/speaker-diarization-3.1"
    pyannote_model_dir: Path | None = None
    diarization_threshold: float = Field(default=0.4, ge=0.0, le=1.0)
    diarization_min_cluster_size: int = Field(default=1, ge=1)
    embedding_model_name: str = "pyannote/embedding"
    speaker_match_threshold: float = Field(default=0.38, ge=0.0, le=1.0)
    speaker_glue_threshold: float = Field(default=0.45, ge=0.0, le=1.0)
    speaker_merge_threshold: float = Field(default=0.52, ge=0.0, le=1.0)
    min_embedding_duration: float = Field(default=1.25, ge=0.0)

    # Silero VAD
    silero_vad_threshold: float = Field(default=0.3, ge=0.0, le=1.0)

    # Anti-hallucination
    hallucination_logprob_threshold: float = Field(default=-1.5, le=0.0)
    max_segment_repeat: int = Field(default=2, ge=1)
    min_audio_rms: float = Field(default=0.001, ge=0.0)
    min_voice_profile_enrollment_duration: float = Field(default=3.0, ge=0.0)
    min_voice_profile_quality_score: float = Field(default=0.45, ge=0.0, le=1.0)

    # Real model chunk override (diarization needs longer audio)
    real_model_chunk_duration_seconds: float = Field(default=30.0, gt=0.0)
    real_model_overlap_duration_seconds: float = Field(default=20.0, ge=0.0)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="KAPTER_AI_",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> WorkerSettings:
    return WorkerSettings()
