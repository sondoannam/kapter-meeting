from __future__ import annotations

import os
import sys
from pathlib import Path

from kapter_ai_worker.config.settings import WorkerSettings
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.logging.logger import get_logger
from kapter_ai_worker.pipeline.streaming_pipeline import StreamingInferencePipeline
from kapter_ai_worker.utils.determinism import enforce_determinism

logger = get_logger("pipeline_factory")
_DLL_DIRECTORY_HANDLES: list[object] = []
_REGISTERED_DLL_DIRECTORIES: set[Path] = set()


def _register_windows_dll_directory(path: Path) -> bool:
    if sys.platform != "win32" or not path.is_dir():
        return False

    normalized_path = path.resolve()
    if normalized_path in _REGISTERED_DLL_DIRECTORIES:
        return False

    handle = os.add_dll_directory(str(normalized_path))
    _DLL_DIRECTORY_HANDLES.append(handle)
    _REGISTERED_DLL_DIRECTORIES.add(normalized_path)
    return True


def _is_ffmpeg_shared_bin(path: Path) -> bool:
    return (
        path.is_dir()
        and any(path.glob("avcodec*.dll"))
        and any(path.glob("avformat*.dll"))
        and any(path.glob("avutil*.dll"))
    )


def _discover_ffmpeg_bin_dirs(settings: WorkerSettings | None = None) -> list[Path]:
    candidates: list[Path] = []

    if settings and settings.ffmpeg_bin_dir is not None:
        candidates.append(settings.ffmpeg_bin_dir)

    for raw_path in os.environ.get("PATH", "").split(os.pathsep):
        if raw_path:
            candidates.append(Path(raw_path))

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        winget_packages = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
        if winget_packages.is_dir():
            candidates.extend(winget_packages.glob("Gyan.FFmpeg.Shared_*/*shared*/bin"))

    shared_bin_dirs: list[Path] = []
    for candidate in candidates:
        try:
            resolved_candidate = candidate.resolve()
        except OSError:
            continue

        if (
            _is_ffmpeg_shared_bin(resolved_candidate)
            and resolved_candidate not in shared_bin_dirs
        ):
            shared_bin_dirs.append(resolved_candidate)

    return shared_bin_dirs


def configure_cuda_dlls(settings: WorkerSettings | None = None) -> None:
    """Ensure the required Windows native library directories are on the DLL search path."""

    if sys.platform != "win32":
        return

    try:
        import torch

        torch_lib_path = Path(torch.__file__).parent / "lib"
        if _register_windows_dll_directory(torch_lib_path):
            logger.debug("Registered torch DLL directory: {}", torch_lib_path)
    except Exception:  # noqa: BLE001
        pass

    for ffmpeg_bin_dir in _discover_ffmpeg_bin_dirs(settings):
        try:
            if _register_windows_dll_directory(ffmpeg_bin_dir):
                logger.info(
                    "Registered FFmpeg shared DLL directory: {}", ffmpeg_bin_dir
                )
        except OSError as error:
            logger.warning(
                "Failed to register FFmpeg shared DLL directory {}: {}",
                ffmpeg_bin_dir,
                error,
            )


def build_mock_pipeline(
    settings: WorkerSettings,
    registry: SpeakerRegistry | None = None,
) -> StreamingInferencePipeline:
    from kapter_ai_worker.models.mock_asr import MockASR
    from kapter_ai_worker.models.mock_diarizer import MockDiarizer
    from kapter_ai_worker.models.mock_vad import MockVoiceActivityDetector

    return StreamingInferencePipeline(
        asr=MockASR(),
        diarizer=MockDiarizer(speaker_prefix=settings.default_speaker_prefix),
        vad=MockVoiceActivityDetector(energy_threshold=settings.vad_energy_threshold),
        registry=registry,
    )


def build_real_pipeline(
    settings: WorkerSettings,
    registry: SpeakerRegistry | None = None,
) -> StreamingInferencePipeline:
    import torch

    if settings.device == "cuda" and torch.cuda.is_available():
        logger.info("Initializing torch CUDA to pre-load cuDNN...")
        torch.zeros(1).cuda()

    from kapter_ai_worker.models.faster_whisper_asr import FasterWhisperASR
    from kapter_ai_worker.models.pyannote_diarizer import PyannoteDiarizer
    from kapter_ai_worker.models.speaker_embedding import SpeakerEmbedding
    from kapter_ai_worker.models.silero_vad import SileroVAD

    embedding_model = SpeakerEmbedding(
        model_name=settings.embedding_model_name,
        hf_token=settings.hf_token,
        device=settings.device,
        min_duration=settings.min_embedding_duration,
    )

    asr = FasterWhisperASR(
        model_name=settings.faster_whisper_model_name,
        model_dir=settings.faster_whisper_model_dir,
        device=settings.device,
        compute_type=settings.faster_whisper_compute_type,
        beam_size=settings.faster_whisper_beam_size,
        language=settings.language,
        hallucination_logprob_threshold=settings.hallucination_logprob_threshold,
        max_segment_repeat=settings.max_segment_repeat,
        min_audio_rms=settings.min_audio_rms,
    )

    diarizer = PyannoteDiarizer(
        model_name=settings.pyannote_model_name,
        hf_token=settings.hf_token,
        device=settings.device,
        threshold=settings.diarization_threshold,
        min_cluster_size=settings.diarization_min_cluster_size,
        embedding_model=embedding_model,
    )

    vad = SileroVAD(threshold=settings.silero_vad_threshold)

    return StreamingInferencePipeline(
        asr=asr,
        diarizer=diarizer,
        vad=vad,
        registry=registry,
    )


def build_pipeline(
    settings: WorkerSettings,
    registry: SpeakerRegistry | None = None,
) -> StreamingInferencePipeline:
    # Enforce deterministic behavior for consistent multi-run results
    enforce_determinism(seed=42)
    
    configure_cuda_dlls(settings)

    if settings.use_real_models:
        return build_real_pipeline(settings, registry=registry)

    return build_mock_pipeline(settings, registry=registry)
