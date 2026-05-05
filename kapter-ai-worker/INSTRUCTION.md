# Kapter AI Worker

## Module Overview

**Module name:** Kapter AI Worker

This module is the Python inference engine for Kapter.

In the target system architecture, it is the AI worker responsible for turning meeting audio into a diarized transcript. In the current repository state, however, it is implemented as a local CLI-first inference package and simulator, not yet as a networked FastAPI service.

Its primary role is to coordinate VAD-based chunking, speech-to-text, speaker diarization, cross-chunk speaker identity tracking, and transcript alignment into a stable output contract.

## System Position

Within the full Kapter architecture, this module is intended to sit between raw meeting audio and downstream backend workflows.

It must eventually support:

- accepting normalized audio or chunk payloads from the NestJS backend
- running VAD, ASR, diarization, and speaker identity linking
- returning a stable diarized transcript contract for downstream LLM extraction

Current code status:

- a local runtime entrypoint exists in `local_runner.py`
- the inference pipeline exists as reusable Python code under `kapter_ai_worker/`
- no backend-facing HTTP service, queue worker, or transport wrapper exists yet

## Tech Stack

- **Language:** Python
- **Configuration:** Pydantic Settings
- **Logging:** Loguru
- **Audio utilities:** NumPy, SoundFile, Torch, Torchaudio
- **VAD:** Silero VAD
- **ASR:** Faster-Whisper
- **Diarization:** Pyannote Audio 3.1
- **Speaker embedding:** Pyannote embedding model
- **Local simulator UI:** Rich
- **Optional local playback:** SoundDevice

## Runtime Requirements

Current runtime expectations:

- local `.wav` file input through `local_runner.py`
- optional Hugging Face token for real Pyannote-based model execution
- CPU or GPU runtime depending on `KAPTER_AI_DEVICE`
- output emitted as Python `DiarizedTranscriptSegment` objects, not HTTP responses
- reuse the existing module-local virtual environment at `kapter-ai-worker/.venv`
- do not create a replacement or ad hoc virtual environment unless the user explicitly asks for environment recovery

## Core Responsibilities

## 1. Audio Ingestion And VAD Chunking

Target responsibility:

- load source audio files
- normalize audio into mono float32 samples
- resample audio to the target worker sample rate
- run voice activity detection and group speech into inference-ready chunks

Current code status:

- `utils/audio.py` loads WAV files, decodes broader media inputs, and now accepts raw PCM (`audio/pcm` / `audio/raw`) HTTP batches
- audio is resampled to 16 kHz when the source sample rate differs
- `generate_vad_audio_chunks()` groups speech spans dynamically instead of slicing by fixed windows only
- both mock VAD and Silero VAD implementations exist

## 2. Speech-To-Text Inference

Target responsibility:

- transcribe speech segments into text
- preserve accurate timestamps for downstream alignment
- support configurable language handling

Current code status:

- `models/faster_whisper_asr.py` is implemented
- word-level timestamps are emitted when the model provides them
- beam search, compute type, and language are configurable
- automatic language detection and session-level language locking exist when the language is not forced
- a mock ASR implementation exists for lightweight local development

## 3. Speaker Diarization And Embedding Extraction

Target responsibility:

- identify speaker turns inside each audio chunk
- generate embeddings that can be linked across chunks
- preserve chunk-relative clustering while allowing global speaker identity tracking

Current code status:

- `models/pyannote_diarizer.py` is implemented
- `models/speaker_embedding.py` is implemented
- Pyannote clustering is explicitly instantiated with centroid clustering and `min_cluster_size=2`
- the diarizer can cooperate with `SpeakerRegistry` for global speaker identity assignment

## 4. Cross-Chunk Speaker Identity Tracking

Target responsibility:

- maintain stable speaker IDs across chunks
- avoid duplicate phantom speakers when the same voice shifts over time
- prevent collisions where two simultaneous local speakers collapse into one global identity

Current code status:

- `core/speaker_registry.py` is implemented
- embedding-based match, glue, and merge heuristics exist
- canonical speaker ID resolution exists through a merged-speaker map
- duplicate speaker consolidation exists
- same-chunk collision handling exists in the diarization flow

## 5. Alignment And Final Transcript Emission

Target responsibility:

- align transcript spans against speaker spans
- emit a stable diarized transcript contract
- merge adjacent same-speaker fragments for cleaner downstream consumption

Current code status:

- `pipeline/streaming_pipeline.py` aligns transcript spans to speaker spans using max-overlap matching
- `utils/alignment.py` consolidates adjacent same-speaker transcript segments
- the primary output contract is `DiarizedTranscriptSegment`

## 6. Local Simulation And Developer Workflow

Target responsibility:

- let teammates exercise the pipeline locally without backend integration
- support mock and real model execution paths
- provide a human-readable simulation view during iteration

Current code status:

- `local_runner.py` is the active developer entrypoint
- mock and real model paths can be switched from the CLI
- optional Rich TUI visualization exists
- optional local audio playback exists
- final merged transcript output is printed in standard CLI mode

## Module Boundaries

This module must stay within the AI inference boundary.

What belongs here:

- audio normalization and chunk preparation
- VAD, ASR, diarization, and speaker embedding wrappers
- speaker identity tracking
- transcript alignment and post-processing
- local simulation tooling

What does not belong here:

- browser capture logic
- Clerk authentication
- database persistence
- Notion sync logic
- LLM action-item extraction
- dashboard UX
- backend WebSocket orchestration

## MVP Constraints

This module must respect the Kapter MVP boundaries:

- the upstream source is Google Meet mixed audio only
- diarization must work from a single mixed stream
- this module is responsible for transcription and speaker labeling only
- task extraction belongs downstream to the backend plus LLM layer
- Notion sync does not belong in this module

## Current Module Structure

Key files and directories:

- `local_runner.py`
  - local CLI simulator and current runtime entrypoint
- `kapter_ai_worker/config/`
  - environment-backed worker settings
- `kapter_ai_worker/core/`
  - base interfaces, entities, and speaker registry
- `kapter_ai_worker/models/`
  - mock and real model adapters
- `kapter_ai_worker/pipeline/`
  - orchestration pipeline
- `kapter_ai_worker/utils/`
  - audio loading, chunk generation, timestamp alignment, formatting helpers
- `kapter_ai_worker/simulator/`
  - Rich visualization and local playback helpers

## Current Implementation Snapshot

Implemented now:

- environment-backed worker settings
- base contracts for VAD, ASR, and diarization
- entity dataclasses for chunk, span, and segment flow
- mock model adapters for fast local development
- real model adapters for Silero VAD, Faster-Whisper, Pyannote diarization, and speaker embedding
- VAD-first dynamic chunk generation
- audio normalization and resampling
- embedding-based cross-chunk speaker tracking and consolidation
- transcript and speaker alignment
- local CLI simulation with optional visualization and playback

Not implemented yet:

- FastAPI or any other worker transport layer
- formal backend-to-worker request and response boundary in code
- end-to-end integration with `kapter-backend`
- automated regression tests for chunking, alignment, and speaker linking
- packaging, lint, or typecheck workflows for this module

## Guidance For Future Work

When extending this module:

- keep transport concerns outside the core inference pipeline until the backend contract is finalized
- preserve the base adapter interfaces so mock and real implementations remain swappable
- keep timestamps absolute relative to the source audio so downstream alignment stays stable
- treat `DiarizedTranscriptSegment` as the primary worker output contract
- update `settings.py`, `.env.example`, and documentation together whenever model thresholds or chunk durations change
- add regression tests before modifying speaker matching and merge heuristics
- run installs, tests, and local entrypoints through `kapter-ai-worker/.venv` instead of the system interpreter or a newly created virtual environment

## Useful Commands

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe local_runner.py path\to\meeting.wav --mock
$env:KAPTER_AI_HF_TOKEN="hf_your_token"
.venv\Scripts\python.exe local_runner.py path\to\meeting.wav --real
.venv\Scripts\python.exe local_runner.py path\to\meeting.wav --visualize --play
```

## Source Of Truth Rule

If future notes, plans, or old discussions conflict with this file, verify the actual code in `kapter-ai-worker/` before changing behavior. This document must track the real implementation state of the AI worker module, not only the intended architecture.
