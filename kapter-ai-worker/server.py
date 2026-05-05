from __future__ import annotations
from kapter_ai_worker.utils.determinism import enforce_determinism

enforce_determinism(seed=42, strict_cpu=False)

from contextlib import asynccontextmanager
import os
import secrets

import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from kapter_ai_worker.config.settings import get_settings
from kapter_ai_worker.contracts.worker_contracts import (
    WorkerAudioBatchRequest,
    WorkerTranscriptionResponse,
)
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.logging.logger import configure_logging, get_logger
from kapter_ai_worker.runtime.pipeline_factory import build_pipeline
from kapter_ai_worker.services.audio_batch_processor import AudioBatchProcessor

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
    registry = SpeakerRegistry(
        match_threshold=settings.speaker_match_threshold,
        glue_threshold=settings.speaker_glue_threshold,
        merge_threshold=settings.speaker_merge_threshold,
    )
    pipeline = build_pipeline(settings, registry=registry)
    _processor = AudioBatchProcessor(settings=settings, pipeline=pipeline)
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


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
