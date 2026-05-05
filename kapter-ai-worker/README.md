# Kapter AI Worker

`kapter-ai-worker` is the Python inference module for the meeting assistant. It now supports two execution modes on top of the same pipeline code:

- a local CLI runner for file-based simulation and debugging
- a thin FastAPI wrapper that accepts buffered audio batches from `kapter-backend`

The pipeline remains transport-agnostic. The HTTP layer is intentionally minimal and delegates all audio decoding, ASR, diarization, and transcript shaping to the shared worker package under `kapter_ai_worker/`.

## Current scope

- local audio-file execution through `local_runner.py`
- backend-facing HTTP batch processing through `server.py`
- pluggable VAD, ASR, and diarization boundaries
- mock and real model selection through shared runtime configuration
- canonical request and response contracts in `kapter_ai_worker/contracts/worker_contracts.py`

## Out of scope for this phase

- queue workers, Celery, or gRPC
- production auth around the FastAPI wrapper
- deployment packaging and infrastructure hardening
- post-transcript artifact extraction and review workflows

## Structure

```text
kapter-ai-worker/
├── .venv/
├── local_runner.py
├── server.py
├── requirements.txt
├── tests/
└── kapter_ai_worker/
    ├── config/
    ├── contracts/
    ├── core/
    ├── logging/
    ├── models/
    ├── pipeline/
    ├── runtime/
    ├── services/
    └── utils/
```

## Environment

Use the module-local virtual environment at `kapter-ai-worker/.venv`.

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

On Windows, real-model decoding needs an FFmpeg shared build. If TorchCodec still cannot locate the FFmpeg DLLs, set `KAPTER_AI_FFMPEG_BIN` to the FFmpeg `bin` directory that contains `avcodec*.dll`, `avformat*.dll`, and `avutil*.dll` before starting the worker.

```powershell
$env:KAPTER_AI_FFMPEG_BIN = "C:\path\to\ffmpeg\bin"
.venv\Scripts\python.exe server.py
```

## Run the local CLI

```powershell
.venv\Scripts\python.exe local_runner.py path\to\meeting.wav --mock --stream-delay-ratio 0.0
```

Useful flags:

```powershell
.venv\Scripts\python.exe local_runner.py path\to\meeting.wav --chunk-duration 2.0 --stream-delay-ratio 1.0
```

- `--mock` skips heavy model loading and uses deterministic mock outputs.
- `--stream-delay-ratio 1.0` sleeps for the chunk duration between iterations to mimic wall-clock streaming.
- `--stream-delay-ratio 0.0` processes as fast as possible.

## Run the FastAPI wrapper

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe server.py
```

Endpoints:

- `GET /health`
- `POST /api/v1/process-audio`

`POST /api/v1/process-audio` accepts the backend worker JSON contract with:

- `streamId`
- `backendMeetingId`
- `sequenceStart`
- `sequenceEnd`
- `streamOffsetMs`
- `durationMs`
- `mimeType`
- `audioBase64`

The endpoint now accepts either containerized audio payloads such as WAV/WebM or raw PCM batches such as `audio/pcm;rate=16000;channels=1;encoding=s16le`.

and returns a `WorkerTranscriptionResponse` with worker-relative segments that the backend later converts into absolute transcript timestamps.

## Tests

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe -m pytest tests/test_process_audio_endpoint.py -q
```

## Implementation notes

- `kapter_ai_worker/runtime/pipeline_factory.py` centralizes mock-versus-real pipeline construction for both CLI and HTTP entrypoints.
- `kapter_ai_worker/services/audio_batch_processor.py` handles batch decoding, MIME-based suffix inference, raw PCM ingestion, and response shaping for the FastAPI wrapper.
- `kapter_ai_worker/utils/audio.py` supports WAV loading through `soundfile`, broader media decode through `torchaudio`, and raw PCM (`s16le`) ingestion, then normalizes audio to mono float32 with resampling.
- `pipeline/streaming_pipeline.py` expects absolute timestamps from model internals inside one batch and leaves cross-batch absolute offset handling to the backend via `streamOffsetMs`.
