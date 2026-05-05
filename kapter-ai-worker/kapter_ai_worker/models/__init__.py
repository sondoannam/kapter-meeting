"""Model implementations and placeholders for the worker package."""

from importlib import import_module
from typing import Any

__all__ = [
    "FasterWhisperASR",
    "MockASR",
    "MockDiarizer",
    "MockVoiceActivityDetector",
    "PyannoteDiarizer",
    "SileroVAD",
]

_LAZY_IMPORTS = {
    "FasterWhisperASR": "kapter_ai_worker.models.faster_whisper_asr",
    "MockASR": "kapter_ai_worker.models.mock_asr",
    "MockDiarizer": "kapter_ai_worker.models.mock_diarizer",
    "MockVoiceActivityDetector": "kapter_ai_worker.models.mock_vad",
    "PyannoteDiarizer": "kapter_ai_worker.models.pyannote_diarizer",
    "SileroVAD": "kapter_ai_worker.models.silero_vad",
}


def __getattr__(name: str) -> Any:
    module_name = _LAZY_IMPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    value = getattr(import_module(module_name), name)
    globals()[name] = value
    return value
