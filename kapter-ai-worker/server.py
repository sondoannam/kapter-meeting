from __future__ import annotations

import base64
from kapter_ai_worker.utils.determinism import enforce_determinism

enforce_determinism(seed=42, strict_cpu=False)

import os
import secrets
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from kapter_ai_worker.config.settings import get_settings
from kapter_ai_worker.contracts.worker_contracts import (
    WorkerAudioBatchRequest,
    WorkerTranscriptionResponse,
    WorkerVoiceProfileCacheUpsertRequest,
    WorkerVoiceProfileEnrollmentRequest,
    WorkerVoiceProfileEnrollmentResponse,
)
from kapter_ai_worker.logging.logger import configure_logging, get_logger
from kapter_ai_worker.runtime.pipeline_factory import build_pipeline
from kapter_ai_worker.services.audio_batch_processor import AudioBatchProcessor
from kapter_ai_worker.services.voice_profile_cache import VoiceProfileCache

logger = get_logger("server")

_processor: AudioBatchProcessor | None = None
_worker_auth = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the pipeline at startup so failures surface immediately."""
    global _processor
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info(
        "Initializing pipeline (use_real_models={})...", settings.use_real_models
    )
    pipeline = build_pipeline(settings)
    voice_profile_cache = VoiceProfileCache(settings.voice_profile_cache_path)
    _processor = AudioBatchProcessor(
        settings=settings,
        pipeline=pipeline,
        voice_profile_cache=voice_profile_cache,
    )
    logger.info("Pipeline ready.")
    yield
    _processor = None


app = FastAPI(title="Kapter AI Worker", version="0.1.0", lifespan=lifespan)


def get_audio_batch_processor() -> AudioBatchProcessor:
    if _processor is None:
        raise RuntimeError("Processor not initialized — server startup failed.")
    return _processor


def require_worker_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_worker_auth),
) -> None:
    expected_secret = get_settings().shared_secret

    if not expected_secret:
        return

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not secrets.compare_digest(credentials.credentials, expected_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    if _processor is None:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
    return {"status": "ok"}


@app.post(
    "/api/v1/process-audio",
    response_model=WorkerTranscriptionResponse,
)
def process_audio_batch(
    request: WorkerAudioBatchRequest,
    _: None = Depends(require_worker_auth),
) -> WorkerTranscriptionResponse:
    try:
        return get_audio_batch_processor().process_request(request)
    except Exception as error:  # noqa: BLE001
        logger.exception(
            "Failed to process audio batch for stream {}",
            request.stream_id,
        )
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post(
    "/api/v1/voice-profiles/enrollment-extract",
    response_model=WorkerVoiceProfileEnrollmentResponse,
)
def extract_voice_profile_enrollment(
    request: WorkerVoiceProfileEnrollmentRequest,
    _: None = Depends(require_worker_auth),
) -> WorkerVoiceProfileEnrollmentResponse:
    try:
        return get_audio_batch_processor().extract_voice_profile_enrollment(
            audio_bytes=base64.b64decode(request.audio_base64, validate=True),
            mime_type=request.mime_type,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Failed to extract voice profile enrollment")
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.put("/api/v1/voice-profiles/cache/{voice_profile_id}")
def upsert_voice_profile_cache(
    voice_profile_id: str,
    request: WorkerVoiceProfileCacheUpsertRequest,
    _: None = Depends(require_worker_auth),
) -> dict[str, str]:
    if voice_profile_id != request.voice_profile_id:
        raise HTTPException(
            status_code=400,
            detail="voiceProfileId path parameter must match request body.",
        )

    get_audio_batch_processor().upsert_voice_profile_cache(
        voice_profile_id=request.voice_profile_id,
        display_name=request.display_name,
        is_active=request.is_active,
        embeddings=request.embeddings,
    )
    return {"status": "ok"}


@app.delete("/api/v1/voice-profiles/cache/{voice_profile_id}")
def delete_voice_profile_cache(
    voice_profile_id: str,
    _: None = Depends(require_worker_auth),
) -> dict[str, str]:
    get_audio_batch_processor().delete_voice_profile_cache(voice_profile_id)
    return {"status": "ok"}


@app.delete("/api/v1/voice-profiles/cache")
def clear_voice_profile_cache(
    _: None = Depends(require_worker_auth),
) -> dict[str, str]:
    get_audio_batch_processor().clear_voice_profile_cache()
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
