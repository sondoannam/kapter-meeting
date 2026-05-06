# Kapter Backend Checkpoint

Last updated: 2026-04-28

This file is the backend module state tracker and todo list for `kapter-backend/`.

It tracks what is already implemented in the NestJS orchestrator and what is still missing for the MVP backend flow.

## Current Module Status

- [x] NestJS backend scaffold exists and builds successfully.
- [x] PostgreSQL schema and Prisma integration exist.
- [x] Clerk-based authentication is implemented for REST and socket handshake verification.
- [x] Clerk webhook sync is implemented for local `User` records.
- [x] Real-time audio gateway entry points exist.
- [x] Audio buffering, worker forwarding, and transcript batch persistence are implemented for the glue phase. (2026-04-21)
- [x] LLM-based artifact extraction is implemented with OpenAI-first provider selection, Gemini fallback, structured JSON validation, and summary/action-item persistence. (2026-04-24)
- [x] User-scoped Notion OAuth setup now exists with persisted connection records, shared-page search, and project destination configuration endpoints. (2026-04-25)
- [x] Notion task sync is implemented through an approved-meeting sync endpoint that creates a Notion destination when needed and marks synced action items. (2026-04-28)
- [x] Added a backend seed script for creating approved mock meeting/action-item data for Postman Notion sync verification, and seeded one local mock meeting. (2026-05-02 17:37 +07:00)
- [x] Addressed review feedback by making the Notion sync seed script derive its Postman URL from backend environment configuration instead of a hardcoded port. (2026-05-02 17:51 +07:00)

## Phase 1: Project Scaffolding

Status: completed.

- [x] NestJS application initialized.
- [x] `ConfigModule` configured globally.
- [x] Joi-based environment validation configured.
- [x] Winston logger module configured.
- [x] Production log rotation support configured.
- [x] Global exception filter registered.
- [x] Global validation pipe registered.
- [x] Helmet enabled.
- [x] CORS configuration wired through app config.
- [x] Swagger/OpenAPI setup available at `/api/docs`.
- [x] Health endpoint implemented.
- [x] Dockerfile created for backend containerization.
- [x] Backend docker compose file exists.

## Phase 2: Database And Auth

Status: in progress.

- [x] Prisma schema designed for core entities.
- [x] Prisma client generation is configured.
- [x] Prisma migrations exist.
- [x] `PrismaService` is configured with the PostgreSQL adapter.
- [x] `User` model includes Clerk identity fields.
- [x] `User` model includes Notion integration fields.
- [x] Clerk env config is present in backend config.
- [x] Clerk webhook controller is implemented.
- [x] Clerk webhook signature verification is implemented.
- [x] Clerk `user.created` sync is implemented.
- [x] Clerk `user.updated` sync is implemented.
- [x] Clerk delete handling is implemented as soft-delete for known local users.
- [x] Existing local users can be linked to Clerk by email.
- [x] Global REST auth guard for Clerk session tokens is implemented.
- [x] Authenticated `GET /api/auth/me` endpoint is implemented.
- [x] Socket handshake Clerk token verification is implemented.
- [x] Socket auth resolves and attaches the local Prisma user context to `socket.data`.
- [ ] Message-level websocket authorization is not enforced beyond handshake authentication.
- [ ] End-to-end auth alignment with the extension bridge flow is not fully complete yet.

## Phase 3: Real-time Audio Gateway

Status: in progress.

- [x] Audio stream module exists.
- [x] Socket.IO gateway exists.
- [x] Configurable websocket namespace exists.
- [x] `stream:start` handler exists.
- [x] `stream:chunk` handler exists.
- [x] `stream:stop` handler exists.
- [x] DTOs exist for stream lifecycle events.
- [x] Gateway logging exists for connect and disconnect events.
- [x] Audio chunk buffering logic is implemented with threshold flush at 10 seconds or 5 chunks and explicit final flush on stop. (2026-04-21)
- [x] Basic per-stream in-memory session state management is implemented through an in-memory stream session store for active recording sessions. (2026-04-21)
- [x] `stream:start` now persists a `Meeting` row in `RECORDING` status and returns the canonical backend meeting ID in the websocket acknowledgement. (2026-04-21)
- [x] Buffered audio is forwarded to the Python FastAPI AI Worker through `AiWorkerClient` and durable `MeetingAudioBatch` rows. (2026-04-21)
- [x] Retry, timeout, disconnect-finalization, and worker failure handling are implemented for the glue phase stream path. (2026-04-21)
- [x] Transcript ingestion back into Prisma is implemented through transactional speaker upserts and segment persistence. (2026-04-21)
- [x] Authenticated dashboard meeting APIs now exist for `GET /api/meetings` and `GET /api/meetings/active`. (2026-04-21)
- [x] Authenticated dashboard meeting detail API now exists for `GET /api/meetings/:meetingId` with transcript, speakers, action items, and processing metadata. (2026-04-22)
- [x] Meeting lifecycle status now moves into `PROCESSING` when capture stops and into `COMPLETED` after the final stream flush finishes successfully. (2026-04-21)
- [x] Dual-lane capture groundwork now exists in backend contracts and persistence: source-aware transport fields were added, `Meeting` and related records gained capture/source metadata fields, and `captureContext` is now persisted on meeting/session start for the planned Meet-only self-mic rollout. (2026-05-02)
- [x] Post-start stream readiness updates now persist degraded self-mic state and expose capture-mode metadata through dashboard meeting summary/detail APIs for Meet dual-lane diagnostics. (2026-05-02)
- [x] Structured dual-lane diagnostics metrics now log self-mic availability, recovered recorder segments, merge conflicts, and duplicate suppressions at the stream-ready and transcript-merge decision points. (2026-05-02)

## Phase 4: Extraction And Sync

Status: in progress.

- [x] LLM module exists.
- [x] LLM config surface exists for OpenAI and Gemini providers.
- [x] Notion module exists.
- [x] Notion integration status surface exists.
- [x] LLM prompt design for structured summary and action item extraction is implemented. (2026-04-24)
- [x] LLM extraction service is implemented with OpenAI/Gemini providers. (2026-04-24)
- [x] Structured validation of extracted JSON artifacts is implemented. (2026-04-24)
- [x] Persistence of summaries and extracted action items is implemented after transcript persistence. (2026-04-24)
- [x] Public Notion setup APIs now exist for connection status, OAuth redirect bootstrap/callback handling, shared page search, and project-level destination configuration. (2026-04-25)
- [x] Local Ollama/Qwen provider selection, project-memory-aware extraction prompts, meeting review endpoints, approval gating, task status, and project-context update proposals are implemented. (2026-04-26)
- [x] Human-in-the-loop review endpoints are implemented for saving edited meeting artifacts and approving the reviewed artifact set. (2026-04-26)
- [x] Users can retry LLM extraction for unapproved meetings through a backend retry endpoint that re-runs extraction and returns the refreshed review payload. (2026-04-26)
- [x] Ollama extraction timeout diagnostics now expose the effective timeout in prompt dumps and failure messages, with local-provider defaults raised for slower structured JSON runs. (2026-04-26)
- [x] Ollama extraction now uses a native Node HTTP transport for `/api/chat` so local-request timeouts are controlled by `OLLAMA_TIMEOUT_MS` instead of hidden fetch headers timeouts. (2026-04-26)
- [x] Retry extraction now schedules background work and returns immediately so dashboard requests do not sit behind proxy timeouts while Ollama is still processing. (2026-04-26)
- [x] Ollama reasoning-model extraction now uses internal streaming plus prompt-scoped schema fallback so long-thinking models can finish without strict `format` stalls or idle-socket drops. (2026-04-27)
- [x] Notion sync execution is implemented for approved meeting action items with automatic project page/database creation when no project database exists. (2026-04-28)
- [x] `ActionItem.isSynced` lifecycle handling is implemented for successful Notion item insertion with persisted `notionPageId`. (2026-04-28)

## Phase 5: Integration Readiness

Status: pending.

- [x] Initial backend contract with the Python AI Worker is now codified in shared TypeScript and worker-side Pydantic models. (2026-04-20)
- [ ] End-to-end extension -> backend -> AI worker -> dashboard flow is not implemented.
- [x] Backend now exposes the first dashboard-facing meeting status surface for the webapp through authenticated history and active-meeting endpoints. (2026-04-21)
- [x] Backend now exposes a meeting detail surface for the webapp with persisted transcript segments and batch-processing progress for realtime polling. (2026-04-22)
- [ ] End-to-end Notion approval and sync flow is not implemented.
- [x] Backend integration tests cover meeting lifecycle orchestration across stream buffering, batch creation, and transcript persistence. (2026-04-21)
- [ ] Production-grade observability for stream processing is not implemented.

## Backend Files With Highest Architectural Weight

- [x] `src/main.ts`
- [x] `src/app.module.ts`
- [x] `src/common/logger/logger.module.ts`
- [x] `src/common/logger/winston.config.ts`
- [x] `src/database/prisma.service.ts`
- [x] `src/modules/clerk/clerk.controller.ts`
- [x] `src/modules/clerk/clerk-webhook.service.ts`
- [x] `src/modules/clerk/clerk-auth.guard.ts`
- [x] `src/modules/clerk/clerk-auth.service.ts`
- [x] `src/modules/clerk/clerk-session.controller.ts`
- [x] `src/modules/audio-stream/audio-stream.gateway.ts`
- [x] `src/modules/audio-stream/audio-stream.service.ts`
- [x] `src/modules/llm/llm.service.ts`
- [x] `src/modules/notion/notion.service.ts`
- [x] `prisma/schema.prisma`

## Known Gaps

- [x] `LlmService.extractMeetingArtifacts()` now builds prompts, calls configured providers, validates structured JSON, and returns meeting artifacts. (2026-04-24)
- [x] `NotionService.syncMeetingActionItems()` inserts unsynced approved action items into Notion and records sync state locally. (2026-04-28)
- [x] The backend now coordinates transcript persistence, LLM extraction, editable review state, approval, and project-context proposal storage. (2026-04-26)
- [x] The backend can execute Notion sync after approval through `POST /api/meetings/:meetingId/notion/sync`. (2026-04-28)
- [ ] Full socket-to-dashboard end-to-end coverage with a live Python worker process is not implemented yet.

## Suggested Next Backend Priorities

- [ ] Implement LLM extraction orchestration with structured JSON output.
- [ ] Persist summaries and action items after transcript ingestion completes.
- [ ] Implement Notion sync after explicit user approval.
- [ ] Add socket-level end-to-end tests with a live AI worker process.
- [ ] Expand stream-processing observability beyond the current structured batch latency logs.

## Progress Log

- [x] 2026-04-18 Attached synced local user context to websocket auth and stream acknowledgements so authenticated audio streams now carry both Clerk and Prisma user identity.
- [x] 2026-04-20 Finalized the first cross-module contract surface from Prisma and the audio-stream DTOs; shared TypeScript contracts now live under `libs/contracts/typescript` and the AI worker has matching Pydantic transport contracts with camelCase aliases.
- [x] 2026-04-21 Started the real JS/TS workspace migration by introducing a root pnpm workspace and formalizing the shared contracts boundary as the `@kapter/contracts` package under `libs/contracts`.
- [x] 2026-04-21 Validated backend participation in the root pnpm workspace build after the contracts-package migration and removed the leftover empty legacy `libs/contracts/typescript` directory so the shared contract source now has a single package boundary.
- [x] 2026-05-02 Added an authoritative `RECORDER` speaker hint to `self_mic` worker batch requests so backend batch construction now distinguishes recorder-owned mic lanes from shared tab audio before merge-stage work begins.
- [x] 2026-04-21 Documented the glue code phase implementation plan in `docs/plans/2026-04-21-glue-code-phase.md`, covering stream buffering, FastAPI worker transport, speaker upserts, transcript persistence, and the required meeting identity contract changes.
- [x] 2026-04-21 Aligned the glue-phase contract surface with canonical `backendMeetingId` handling, added `externalMeetingId` plus `MeetingAudioBatch` to Prisma, introduced AI-worker and meetings modules, and made `stream:start` persist active meeting/session state before acknowledging the extension.
- [x] 2026-04-21 Completed the backend glue-phase stream path with threshold buffering, durable worker batch transport, transcript persistence, disconnect timeout handling, and backend integration coverage.
- [x] 2026-04-21 Added the first dashboard-facing meetings controller, meeting history and active-meeting queries, and a verified status lifecycle of RECORDING -> PROCESSING -> COMPLETED for stopped captures.
- [x] 2026-04-21 Added on-demand Clerk user hydration for authenticated HTTP and websocket flows so missing local `User` rows can self-heal from Clerk when webhook delivery has not populated Prisma yet.
- [x] 2026-04-22 Added `GET /api/meetings/:meetingId` so the dashboard can poll one meeting for transcript segments, speaker roster, action items, and audio-batch processing progress while recording or post-stop processing is still underway.
- [x] 2026-04-24 Implemented backend LLM artifact extraction with OpenAI-first provider selection, Gemini fallback, structured summary/task validation, post-transcript persistence, and stream-finalization integration.
- [x] 2026-04-25 Fixed LLM extraction PR review notes by moving providers to NestJS DI, aligning nullable JSON schema, and scheduling artifact extraction after meeting completion.
- [x] 2026-04-25 Removed the session object reference from background LLM extraction scheduling so async artifact extraction uses only immutable meeting context.
- [x] 2026-04-25 Added `db:empty:keep-user` maintenance script to truncate all backend tables except `User` and `_prisma_migrations` for fast cloud DB refreshes.
- [x] 2026-04-25 Started the project foundation phase by adding `Project` and `ProjectContext` Prisma models plus the `20260425094654_add_projects_foundation` migration, wiring `Meeting.projectId` ownership with backend draft-project fallback, and exposing authenticated backend project CRUD endpoints.
- [x] 2026-04-25 Hardened the project foundation rollout by backfilling draft projects for existing meetings in the Prisma migration and making audio-stream integration tests auto-apply migrations plus clean `Project` and `ProjectContext` state before each run.
- [x] 2026-04-25 Replaced the hand-edited project foundation migration with a Prisma-generated transitional migration by making `Meeting.projectId` nullable in schema, regenerating the migration as `20260425101040_add_projects_foundation`, and keeping backend validation green under the standard Prisma workflow.
- [x] 2026-04-25 Implemented the Notion setup slice with persisted `NotionConnection` OAuth state, backend connect/search/project-destination routes, and the Prisma migration `20260425111320_notion_setup_oauth`.
- [x] 2026-04-26 Implemented the contextual memory extraction phase with env-selectable Ollama/Qwen support, project-context and tactical-task prompt memory, editable meeting review APIs, meeting-level artifact approval, task status, and review-gated project-context update proposals.
- [x] 2026-04-26 Added a meeting extraction retry endpoint so failed or unsatisfactory unapproved LLM output can be regenerated without changing approved artifacts.
- [x] 2026-04-26 Traced Ollama extraction timeout behavior against the dumped backend prompt, raised the local-provider timeout default to 300 seconds, and added effective-timeout diagnostics to prompt dumps and timeout errors.
- [x] 2026-04-26 Reproduced the meeting-artifacts timeout against Ollama from the real provider path, identified Node fetch's hidden headers timeout as a second failure mode, and moved the provider back to `/api/chat` using a native HTTP transport controlled only by `OLLAMA_TIMEOUT_MS`.
- [x] 2026-04-26 Traced dashboard retry failures to a synchronous HTTP request lifecycle, then changed retry extraction to schedule background work so the backend can finish after the client request has already returned.
- [x] 2026-04-27 Switched Ollama extraction into internal streaming, added a reasoning-safe prompt/schema path with local fenced-JSON parsing, and kept an explicit schema-mode fallback for non-reasoning models or forced config overrides.
- [x] 2026-04-28 Implemented backend Notion task sync for approved meeting artifacts, including automatic project page/database creation, data-source-aware task insertion, local `ActionItem` sync state updates, and focused service/controller test coverage.
- [x] 2026-04-28 Replaced one-shot meeting extraction with transcript-window chunk planning, durable draft/task mutation state, summary reduction finalization, the Prisma migration `20260428071841_transcript_window_dual_track_extraction`, and passing backend validation for the new chunked processing path.
- [x] 2026-04-28 Added env-gated meeting extraction trace dumps under `LOG_DIR` so chunk planning, retries, and finalization can be inspected from plain-text files before running real meeting captures.
- [x] 2026-04-28 Upgraded OpenAI and Gemini providers with cloud-specific timeout/retry controls, prompt-dump and request-usage diagnostics, and better extraction defaults (`gpt-4.1-mini` and `gemini-2.5-flash-lite` with explicit Gemini thinking-budget control).
- [x] 2026-04-28 Hardened backend Notion sync retries with a persistent Notion-side item key for duplicate reconciliation, documented the intentional `data_sources` API usage against Notion version `2026-03-11`, and refreshed the root README to match the current review/sync implementation state.
- [x] 2026-04-28 Added a backend GitHub Actions workflow that installs the workspace, builds shared contracts, runs lint/typecheck/test/build against a Postgres service, and hardened Gemini success logging to tolerate missing nested SDK status metadata during CI.
- [x] 2026-04-29 Enriched `GET /api/meetings/:meetingId` with Notion sync-readiness data from the owning user and project, including connected workspace metadata, project destination state, and synced-versus-unsynced action-item counts for staged dashboard workflows.
- [x] 2026-04-29 Split backend health into lightweight liveness plus readiness probes across Prisma, the AI worker, and configured LLM providers, including explicit OpenAI/Gemini auth diagnostics for cloud-key debugging.
- [x] 2026-04-30 Implemented `isFinal` flag in `AiWorkerClient` and `AudioStreamService` to ensure the final audio buffer is flushed to the worker when a meeting stops.
- [x] 2026-05-01 09:44 +07:00 Added the local Vite `http://localhost:5174` origin to backend CORS and Clerk authorized parties so the webapp can call `localhost:3001` during dashboard and Notion setup testing.
- [x] 2026-05-01 21:52 +07:00 Fixed transcription "ghosting" (duplicate segments) by implementing normalized fuzzy prefix stripping and **Sentence-level Deduplication** to filter Whisper hallucinations.
- [x] 2026-05-01 21:45 +07:00 Implemented `finishing` state in Extension UI/UX (Plan C) to handle long-running final audio processing without triggering generic timeout errors. Increased client-side timeouts to 60s.
- [x] 2026-05-02 17:37 +07:00 Added `scripts/seed-notion-sync-mock.ts` so local testers can create an approved meeting with unsynced action items and call the Notion sync endpoint from Postman.
- [x] 2026-05-02 17:51 +07:00 Updated the Notion sync seed script to generate Postman URLs from `BACKEND_BASE_URL` or `PORT` instead of hardcoding `localhost:3001`.
- [x] 2026-05-02 Started dual-lane backend groundwork by expanding shared transport contracts, adding optional capture/source persistence fields in Prisma, and persisting `captureContext` at meeting/session start without changing current audio behavior.
- [x] 2026-05-02 Created and applied Prisma migration `20260502074753_dual_lane_capture_groundwork` so the dual-lane groundwork fields are now represented in migration history instead of schema state only.
- [x] 2026-05-02 Tagged the current single-lane backend runtime as `tab_mix`, so worker requests, `MeetingAudioBatch` rows, and persisted transcript segments now carry source metadata before the future `self_mic` lane is introduced.
- [x] 2026-05-02 Replaced the backend's single shared audio queue with per-source session state, so ordering, mime validation, buffering, flush lifecycles, and disconnect finalization are now tracked independently per source while still preserving one logical meeting session.
- [x] 2026-05-02 Added transcript merge reconciliation for dual-lane capture, including conservative overlap detection, `self_mic`-preferred duplicate suppression, durable merge provenance fields plus migration `20260502082348_transcript_segment_merge_provenance`, and suppressed-segment filtering in meeting detail and extraction reads.
- [x] 2026-05-02 Added a post-start `stream:ready` capture-state update so degraded recorder-mic status is persisted after lane boot, and surfaced capture/degraded/source metadata in dashboard meeting summary and detail responses.
- [x] 2026-05-02 Added structured dual-lane metric logs for self-mic availability and merge reconciliation outcomes so internal diagnostics can quantify degraded sessions, recovered recorder speech, merge conflicts, and duplicate suppression counts.
- [x] 2026-05-02 Exposed transcript source provenance and merge flags through the meeting detail API so dual-lane review can verify which lane produced each persisted segment and where duplicate or ambiguous overlap logic applied.
- [x] 2026-05-02 Fixed the dual-lane `MeetingAudioBatch` uniqueness bug by making the batch key source-aware (`streamId + sourceType + sequenceStart + sequenceEnd`), generating Prisma migration `20260502182300_meeting_audio_batch_source_uniqueness`, applying it to Neon via `prisma db execute`, and registering it after clearing a stale advisory lock on the pooled migration session.
- [x] 2026-05-02 Hardened generic-tab capture by ignoring stray `self_mic` chunks outside `google_meet_room`, so backend buffering no longer creates recorder-lane worker requests when a non-Meet session or stale extension path sends microphone-tagged traffic.
