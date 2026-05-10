# Kapter AI Worker Checkpoint

Last updated: 2026-04-21

This file is the AI worker module state tracker and todo list for `kapter-ai-worker/`.

It reflects the current implementation state of the Python inference module based on the code that exists today.

## Current Module Status

- [x] The Python AI worker package scaffold exists and runs through `local_runner.py`.
- [x] Mock and real model implementations exist for VAD, ASR, and diarization.
- [x] Dynamic VAD-based chunk generation is implemented.
- [x] Cross-chunk speaker identity tracking is implemented.
- [x] Transcript and speaker alignment plus final segment consolidation are implemented.
- [x] Local visualization and playback tooling exist.
- [x] A backend-facing FastAPI transport layer now exists alongside the local CLI runner. (2026-04-21)
- [x] Targeted automated tests exist for the FastAPI audio-batch endpoint, and the runtime dependency list now matches the implemented imports. (2026-04-21)
- [x] The FastAPI audio-batch endpoint now accepts raw PCM streaming batches in addition to containerized uploads. (2026-04-21)

## Phase 1: Project Scaffolding And Configuration

Status: in progress.

- [x] Python module directory structure exists.
- [x] `WorkerSettings` exists in `config/settings.py`.
- [x] `.env.example` exists.
- [x] `local_runner.py` exists as the current runtime entrypoint.
- [x] component-level logging wrapper exists.
- [x] `requirements.txt` lists the simulator, FastAPI, and audio runtime imports used by the current code. (2026-04-21)
- [ ] no packaging, lint, or typecheck workflow exists yet.

## Phase 2: Core Contracts And Shared Entities

Status: completed.

- [x] `BaseASR` exists.
- [x] `BaseDiarizer` exists.
- [x] `BaseVoiceActivityDetector` exists.
- [x] `AudioChunk` dataclass exists.
- [x] `TranscriptSpan` dataclass exists.
- [x] `SpeakerSpan` dataclass exists.
- [x] `DiarizedTranscriptSegment` dataclass exists.
- [x] `PipelineChunkResult` dataclass exists.
- [x] `StreamingInferencePipeline` accepts dependency-injected model implementations.

## Phase 3: Audio Ingestion And VAD

Status: in progress.

- [x] local `.wav` loading exists.
- [x] mono float32 normalization exists.
- [x] automatic resampling to 16 kHz exists.
- [x] VAD-first dynamic chunk generation exists.
- [x] mock VAD exists.
- [x] Silero VAD exists.
- [ ] direct streaming or network audio adapters are not implemented yet.

## Phase 4: ASR And Diarization

Status: in progress.

- [x] Faster-Whisper adapter exists.
- [x] word-level timestamps are emitted when available.
- [x] forced-language and auto-detect plus lock flows exist.
- [x] degenerate word/segment spans with end_time <= start_time are filtered before entering the pipeline contract layer. (2026-04-23)
- [x] Anti-hallucination layer: RMS silence detection, logprob confidence gating, repetition detection, pattern filtering, `condition_on_previous_text=False`, `repetition_penalty=1.2`. Whisper internal VAD disabled to prevent double-filtering. (2026-04-23)
- [x] Pyannote diarizer exists.
- [x] Pyannote output attribute handling supports both `.speaker_diarization` and direct annotation return. (2026-04-23)
- [x] speaker embedding wrapper exists with configurable `min_embedding_duration` filter (default 1.5s). (2026-04-23)
- [x] Pyannote clustering is explicitly tuned with centroid clustering and `min_cluster_size=2`.
- [x] Real-model tuning defaults unified: `settings.py`, `.env`, `.env.example` all carry `speaker_glue_threshold`, `speaker_merge_threshold`, `min_embedding_duration`, and anti-hallucination knobs. (2026-04-23)

## Phase 5: Speaker Identity And Alignment

Status: completed.

- [x] `SpeakerRegistry` tracks speaker profiles across chunks.
- [x] cosine-similarity match, glue, and merge logic exists.
- [x] canonical speaker ID remapping exists.
- [x] duplicate speaker consolidation exists.
- [x] same-chunk speaker collision avoidance exists in the diarization flow.
- [x] transcript-to-speaker alignment uses max-overlap matching.
- [x] word-level spans are grouped into phrase-level spans before alignment for better overlap matching accuracy. (2026-04-23)
- [x] `SpeakerRegistry` thresholds (`glue_threshold`, `merge_threshold`) are now configurable via settings and `.env`. (2026-04-23)
- [x] Short-segment force-assign removed; segments under 2s with low match score now return `UNKNOWN` instead of being randomly assigned. (2026-04-23)
- [x] final segment consolidation exists.

## Phase 6: Local Simulation Workflow

Status: in progress.

- [x] mock versus real model selection exists.
- [x] chunk duration override exists.
- [x] stream delay ratio exists.
- [x] expected sample rate override exists.
- [x] optional Rich TUI visualization exists.
- [x] optional local audio playback exists.
- [x] consolidated CLI transcript output exists.
- [ ] per-stage latency metrics and benchmark reporting do not exist yet.

## Phase 7: Service And Integration Readiness

Status: in progress.

- [x] a FastAPI server exists in `server.py` and exposes `/health` plus `/api/v1/process-audio`. (2026-04-21)
- [x] a backend-facing HTTP API exists for `WorkerAudioBatchRequest` -> `WorkerTranscriptionResponse` processing. (2026-04-21)
- [x] formal backend-to-worker request and response contract models exist under `kapter_ai_worker/contracts/`, and now carry canonical `backendMeetingId`, `sequenceStart`/`sequenceEnd`, and `streamOffsetMs` fields for the glue phase. (2026-04-21)
- [ ] no live end-to-end integration with `kapter-backend` exists yet.
- [ ] no persistence or review-layer handoff exists beyond in-memory Python objects.

## Phase 8: Documentation Alignment

Status: in progress.

- [x] `INSTRUCTION.md` was rewritten in English to reflect the current worker boundaries. (2026-04-18)
- [x] `checkpoint.md` was rewritten in English to match the backend/webapp status-tracker format. (2026-04-18)
- [x] `README.md` now documents both the CLI runner and the FastAPI wrapper, including the `.venv` workflow. (2026-04-21)
- [x] Worker documentation now reflects raw PCM batch ingestion for extension-driven live streaming. (2026-04-21)

## Current Algorithm Notes

- VAD is handled during chunk generation in `generate_vad_audio_chunks()`, not inside `StreamingInferencePipeline`.
- Whisper internal `vad_filter` is disabled to avoid double-filtering; pipeline Silero VAD is the single source of truth.
- `SpeakerRegistry` uses configurable thresholds: `match_threshold=0.55`, `glue_threshold=0.45`, `merge_threshold=0.62`.
- Pyannote diarization is instantiated with centroid clustering and `min_cluster_size=2`.
- Speaker embeddings require `min_embedding_duration=1.5s` to avoid noisy vectors from short segments.
- Word-level ASR spans are grouped into phrase-level spans before speaker alignment.
- Collision handling in `PyannoteDiarizer` prevents two distinct local speakers inside one chunk from sharing the same global ID.
- Anti-hallucination: RMS pre-check, logprob < -1.0 filter, repetition detection, pattern matching for known Whisper hallucination strings.
- Real-model chunk duration is `25.0s` for sufficient Pyannote clustering context.

## Highest-Weight Files Right Now

- [x] `local_runner.py`
- [x] `kapter_ai_worker/config/settings.py`
- [x] `kapter_ai_worker/core/entities.py`
- [x] `kapter_ai_worker/core/speaker_registry.py`
- [x] `kapter_ai_worker/pipeline/streaming_pipeline.py`
- [x] `kapter_ai_worker/models/faster_whisper_asr.py`
- [x] `kapter_ai_worker/models/pyannote_diarizer.py`
- [x] `kapter_ai_worker/models/speaker_embedding.py`
- [x] `kapter_ai_worker/models/silero_vad.py`
- [x] `kapter_ai_worker/utils/audio.py`
- [x] `kapter_ai_worker/utils/alignment.py`
- [x] `kapter_ai_worker/simulator/visualizer.py`

## Known Gaps

- [ ] `WorkerSettings` defaults and `.env.example` still differ for important runtime knobs such as `use_real_models`, `language`, `silero_vad_threshold`, and `real_model_chunk_duration_seconds`.
- [ ] no automated regression tests exist yet around chunking, registry consolidation, or alignment.
- [ ] the FastAPI wrapper is intentionally thin and does not yet provide queueing, authentication, or deployment packaging.

## Suggested Next AI Worker Priorities

- [ ] unify settings defaults, `.env.example`, and README values.
- [ ] add regression tests for VAD chunking, speaker linking, collision handling, and segment consolidation.
- [ ] harden the FastAPI wrapper with auth, queueing, or deployment concerns once the glue phase is stable.
- [ ] expose richer latency metrics from the pipeline for backend observability.

## Progress Log

- [x] 2026-04-20 Added Pydantic backend-worker contract models with camelCase aliases for batch requests and diarized transcript responses, bridging worker snake_case internals to the NestJS-facing JSON contract.
- [x] 2026-04-21 Documented the first end-to-end glue code execution plan in `docs/plans/2026-04-21-glue-code-phase.md`, including the minimal FastAPI wrapper, worker-side media decode path, and transcript handoff back into Prisma.
- [x] 2026-04-21 Updated the worker transport models to the glue-phase identity contract so backend-facing requests and responses now serialize canonical `backendMeetingId`, sequence bounds, and batch stream offsets.
- [x] 2026-04-21 Added the FastAPI audio-batch wrapper, shared pipeline factory, endpoint smoke test, and `.venv`-based runtime verification for the worker glue phase.
- [x] 2026-04-21 Added Windows FFmpeg shared-DLL bootstrap support so the worker can register `KAPTER_AI_FFMPEG_BIN` or auto-detected Gyan shared installs before TorchCodec loads.
- [x] 2026-04-21 Added raw PCM (`audio/pcm` / `audio/raw`) batch decoding and endpoint coverage so live extension chunks no longer depend on concatenated WebM container fragments.
- [x] 2026-04-23 Anti-hallucination overhaul: disabled Whisper internal VAD, added RMS silence pre-check, logprob confidence gating, cross-segment repetition detection, and suspicious pattern filtering.
- [x] 2026-04-23 Diarization quality improvements: increased chunk duration to 25s, added min embedding duration filter (1.5s), made glue/merge thresholds configurable, removed short-segment force-assign logic, added word-to-phrase grouping before speaker alignment, and fixed Pyannote output attribute handling.
- [x] 2026-04-23 Resolved ASR hallucination and diarization fragmentation: removed global language locking to allow per-chunk multi-lingual auto-detection, switched to word-level overlap alignment with nearest-neighbor fallback to eliminate UNKNOWN gaps, disabled Pyannote collision-avoidance to fix over-segmentation, and relaxed ASR thresholds (no_speech, RMS) to prevent word dropping.
- [x] 2026-04-23 Addressed code-quality review: fixed memory leak false-positive in \_recent_texts by using deque, added public registry methods get_speaker and get_last_active_speaker to prevent private attribute violation, and secured max() fallback against empty registry errors.
- [x] 2026-04-24 Speaker identification optimization: Implemented Sliding Window (5s overlap) with Dynamic VAD, Dynamic Thresholding for short segments, Multi-label Alignment for cross-talk, and Embedding Hygiene to prevent profile contamination from mixed or duplicate segments.
- [x] 2026-04-28 Added module-scoped GitHub Actions coverage for the AI worker with a CPU-only `requirements-ci.txt` path so mock-mode pytest can run in CI without the local CUDA install assumptions.
- [x] 2026-04-29 Speaker diarization stability fixes: Synced `.env.example` with optimized thresholds (chunk=30s, match=0.55), implemented Nearest Exemplar matching to prevent intra-speaker fragmentation, and removed multi-label output to ensure single strict speaker assignment per phrase.
- [x] 2026-04-30 Fixed potential logic error in `PyannoteDiarizer` by initializing `embedding = None` to prevent `UnboundLocalError`.
- [x] 2026-04-30 Implemented global speaker fallback in `PyannoteDiarizer` and LRU/TTL memory management in `StreamingInferencePipeline` for better accuracy and stability.
- [x] 2026-04-30 Refined `PyannoteDiarizer` fallback with bounded gap handling (-0.5s to 20s) and implemented a Hybrid Throttled Cleanup Strategy in `StreamingInferencePipeline` for production-grade robustness.
- [x] 2026-04-30 Fixed "speaker bleeding" at boundaries by implementing fuzzy overlap matching and lookahead transition bias (600ms tolerance) in `StreamingInferencePipeline`.
- [x] 2026-04-30 Fixed "missing end" issue by implementing `isFinal` flag in `WorkerAudioBatchRequest` and forcing AI worker to flush the remaining buffer at the end of a meeting.
- [x] 2026-04-30 Enhanced stability using **Nearest Exemplar Matching** and increased diarization context (25s) to prevent identity drift and boundary flickering.
- [x] 2026-05-01 Fixed "previous speaker swallows following speaker" issue by implementing Transition Priority scoring and relaxing fuzzy overlap boundaries in `StreamingInferencePipeline`.
- [x] 2026-05-01 Fixed `NameError: strip_overlap` in `StreamingInferencePipeline` by adding the missing import from `utils.alignment`.
- [x] 2026-05-01 Fixed cold-start speaker swallowing by scaling Active Speaker Bias and reducing discovery thresholds in `SpeakerRegistry` and `PyannoteDiarizer`.
- [x] 2026-05-01 22:15 +07:00 Implemented **Fuzzy Prefix Stripping** in `utils.alignment` to handle ASR timestamp jitter and minor word variations.
- [x] 2026-05-01 23:10 +07:00 Added **Sentence-level Deduplication** in `StreamingInferencePipeline` to filter out Whisper hallucinations where it repeats long historical blocks in the middle of new segments.
- [x] 2026-05-01 23:15 +07:00 Stabilized speaker identity by increasing **Active Speaker Bias** to 0.12 and reducing `initial_prompt` context to 120 words to minimize over-prompting noise.
- [x] 2026-05-02 10:40 +07:00 Implemented **VAD State Resets** and **Per-Stream Locking** to ensure determinism and prevent race conditions in concurrent streaming.
- [x] 2026-05-02 10:45 +07:00 Added **Audio Decoding Observability** in `utils/audio.py` to track sample count and RMS consistency for debugging jitter.- [x] 2026-05-02 14:15 +07:00 Fixed **Stream Lock Memory Leak** in StreamingInferencePipeline by ensuring per-stream locks are removed when clear() is called at the end of a session.
- [x] 2026-05-02 Expanded the worker transport groundwork for dual-lane capture by adding optional `captureContext`, `sourceType`, and authoritative-speaker hint fields to the backend-facing Pydantic contract models while keeping the current runtime path backward-compatible.
- [x] 2026-05-02 Updated the worker response path to echo current-lane metadata (`captureContext` and `sourceType`) so existing single-lane processing now returns explicit `tab_mix` source annotations without changing diarization behavior.
- [x] 2026-05-02 Isolated `tab_mix` and `self_mic` processing state inside `AudioBatchProcessor` by per-lane keys, preserved batch-relative timestamps for the backend contract, and applied authoritative `RECORDER` speaker labels to `self_mic` output without contaminating the shared tab lane registry.
- [x] 2026-05-02 Added an ASR-first `self_mic` path by letting `StreamingInferencePipeline` skip diarization when an authoritative speaker label is supplied, while preserving the existing transcript stitching/dedup logic and keeping `tab_mix` on the diarization-heavy path.
- [x] 2026-05-02 Fixed negative worker segment timestamps in the dual-lane live path by making `self_mic` process each backend batch independently, keying response offsets to the actual processed window start, and adding regression coverage for both buffered `tab_mix` windows and batch-local `self_mic` batches.
- [x] 2026-05-02 Added a capture-context guard in `AudioBatchProcessor` so `self_mic` requests are ignored unless they explicitly come from `google_meet_room`, preventing generic-tab sessions or stale clients from producing hallucinated authoritative `RECORDER` transcript output.
- [x] 2026-05-05 19:11 +07:00 Added deployment-ready worker bearer auth, Cloud Run `PORT` support, a CPU-oriented Cloud Run container (`Dockerfile`, `requirements-cloud.txt`, `.env.cloudrun.example`), and passing endpoint coverage for the secured process-audio route.
- [x] 2026-05-05 23:58 +07:00 Added local-worker deployment guidance for the final hosting plan by extending `.env.example` with shared-secret notes and committing `cloudflared.example.yml` for `kapter-worker.sondndev.id.vn`.
- [x] 2026-05-09 Clamped near-zero negative transcript timestamps during worker response serialization so `process-audio` no longer fails on floating-point jitter when a segment start lands slightly below zero.
