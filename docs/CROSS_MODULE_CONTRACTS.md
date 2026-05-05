# Cross-Module Contracts

## Source Of Truth

- Backend database entities come from `kapter-backend/prisma/schema.prisma`.
- Backend websocket payloads come from `kapter-backend/src/modules/audio-stream/dto/`.

## Shared TypeScript Contract Surface

- Location: `libs/contracts`
- Canonical TypeScript source lives under `libs/contracts/src` only.
- Runtime output under `libs/contracts/dist` is generated and should not be treated as source of truth.
- Main exports:
  - `Meeting`, `MeetingStatus`
  - `MeetingAudioBatch`, `MeetingAudioBatchStatus`
  - `SpeakerProfile`
  - `TranscriptSegment`, `TranscriptSegmentWithSpeaker`
  - `ActionItem`, `ActionItemWithAssignee`
  - `MeetingWithArtifacts`
  - `StreamStartPayload`, `StreamChunkPayload`, `StreamStopPayload`
  - `StreamStartAckPayload`, `StreamChunkAckPayload`, `StreamStopAckPayload`
  - `WorkerAudioBatchRequest`, `WorkerTranscriptSegment`, `WorkerTranscriptionResponse`

## Shared Python Contract Surface

- Location: `kapter-ai-worker/kapter_ai_worker/contracts`
- Main exports:
  - `WorkerAudioBatchRequest`
  - `WorkerTranscriptSegment`
  - `WorkerTranscriptionResponse`

## Naming Rule

- Network JSON stays camelCase because the NestJS DTOs and TypeScript clients already use camelCase.
- Python internals stay snake_case.
- The worker contract models bridge the two by using snake_case field names with camelCase aliases.
- Always serialize worker responses with `model_dump(by_alias=True)` or `to_backend_dict()`.

## Meeting Identity Rule

- The websocket `meetingId` sent by the extension is the external Google Meet code.
- The backend persists that value as `Meeting.externalMeetingId`.
- On `stream:start`, the backend returns the canonical Prisma meeting identifier as `backendMeetingId` in `StreamStartAckPayload`.
- Backend-to-worker requests and worker responses must use `backendMeetingId` and never reuse the external transport identifier as the durable database key.

## Current Glue Flow

### Audio Aggregator

1. On `stream:start`, create an in-memory stream state keyed by `streamId` with the authenticated user, the transport meeting identifier, an empty chunk queue, and a running `durationMs` counter.
2. On each `stream:chunk`, append the ordered chunk to the queue and reject out-of-order sequence numbers.
3. Flush to the worker when either five 2-second chunks have arrived or the buffered duration reaches at least `10_000` ms.
4. Build a `WorkerAudioBatchRequest` from the buffered sequence window, concatenate or remux the audio into one payload, and call the worker asynchronously.
5. On `stream:stop`, flush any remaining buffered audio and keep the session open until all in-flight worker batches resolve.
6. If the client disconnects without sending `stream:stop`, transition the stream into the same forced-flush path and fail it after `AUDIO_BUFFER_IDLE_TIMEOUT_MS` if the session never drains.

### Durable Batch Lifecycle

1. The backend creates a `MeetingAudioBatch` row before each worker request.
2. The batch moves through `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED` in Prisma.
3. `TranscriptPersistenceService` is responsible for marking batches `COMPLETED` only after transcript rows and speaker upserts commit successfully.

### Diarization Mapping

1. For each `WorkerTranscriptSegment`, use `aiLabel` as the stable lookup key for `SpeakerProfile`.
2. Upsert `SpeakerProfile` by the unique constraint `(meetingId, aiLabel)` with `realName = null` until the dashboard resolves it.
3. Build the `aiLabel -> speakerProfile.id` map transactionally while persisting one worker batch.
4. Persist `TranscriptSegment` rows with absolute timestamps by adding `response.streamOffsetMs / 1000` to the worker-relative segment offsets.
5. Let the dashboard update `SpeakerProfile.realName` during human review.

## Sync Rule

- If a field changes in Prisma or the backend websocket DTOs, update the TypeScript contracts and the Python worker contracts in the same change set.

## JavaScript Workspace Rule

- JavaScript and TypeScript consumers should import shared contracts through the real workspace package `@kapter/contracts`.
- Runtime consumers must build the contracts package before relying on its JS entrypoints. The extension now does this automatically in its `predev` and `prebuild` hooks.
- NodeNext consumers should resolve contract types from the built declaration files published under `libs/contracts/dist` through the package export map, not by importing the source tree directly.
- Do not recreate the removed legacy `libs/contracts/typescript` tree.
- Do not point app-local aliases at another package's source tree.
- Do not reintroduce `rootDir: ".."` style workarounds to compile sibling source into an app build.
