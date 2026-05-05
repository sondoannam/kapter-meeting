# Kapter Backend Orchestrator

## Module Overview

**Module name:** Kapter Backend Orchestrator

This NestJS application is the backend orchestrator for Kapter, an AI meeting assistant for small tech teams.

Its primary role is to sit between four system boundaries:

- the Chrome Extension that captures Google Meet audio
- the Web Dashboard used for review and approval workflows
- Clerk as the single authentication provider
- the Python FastAPI AI Worker that performs transcription and speaker diarization

The backend is the system gateway. It owns authenticated APIs, authenticated real-time connections, database state, external system coordination, and downstream orchestration.

## System Position

Within the full Kapter architecture, this module is responsible for:

- accepting authenticated requests from the dashboard
- accepting authenticated real-time audio streaming sessions from the extension
- persisting application state in PostgreSQL via Prisma
- keeping the local `User` table synchronized with Clerk identity events
- forwarding processed artifacts into downstream integrations such as Notion
- coordinating LLM extraction workflows using OpenAI, Gemini, or local Ollama providers

This module is **not** the ML inference engine. Speech-to-Text and speaker diarization belong to the Python worker.

## Tech Stack

- **Framework:** NestJS
- **Database ORM:** Prisma
- **Database:** PostgreSQL
- **Real-time transport:** Socket.IO
- **Authentication:** Clerk
- **Webhook verification:** Clerk/Svix-signed webhook verification
- **Logging:** Winston with `nest-winston`
- **API documentation:** Swagger
- **Security middleware:** Helmet, global validation pipes, CORS configuration
- **LLM providers:** local Ollama/Qwen by default, with OpenAI SDK or Gemini SDK as configurable cloud providers

## Core Responsibilities

## 1. WebSocket Gateway

The backend must receive audio stream events from the Chrome Extension, validate the user session, and coordinate real-time ingestion.

Target responsibility:

- accept authenticated Socket.IO connections from the extension
- receive `stream:start`, `stream:chunk`, and `stream:stop` events
- buffer and track stream state per client/session
- hand audio or chunk references to the Python AI Worker
- manage stream lifecycle, retries, and failure handling

Current code status:

- Socket.IO gateway exists
- handshake-time Clerk token verification exists
- stream event handlers exist
- chunk buffering and worker forwarding are not implemented yet

## 2. Clerk Webhook Sync

The backend must keep its local `User` table synchronized with Clerk.

Target responsibility:

- listen to Clerk `user.created`, `user.updated`, and lifecycle events
- verify webhook signatures against the raw request body
- normalize Clerk payloads into local user records
- create, update, link, or soft-delete users in Prisma safely and idempotently

Current code status:

- webhook controller exists at `POST /api/clerk/webhooks`
- raw request verification is implemented
- local user sync by `clerkId` is implemented
- existing local users can be linked by email
- delete events soft-delete existing local users and ignore unknown local identities

## 3. LLM Orchestration

The backend must take diarized transcript output from the AI Worker and transform it into structured business artifacts.

Target responsibility:

- receive diarized transcript payloads from the AI Worker
- build prompts for structured extraction
- call an OpenAI or Gemini provider
- require JSON-shaped output for summaries and action items
- validate, normalize, and persist extracted artifacts

Current code status:

- LLM provider config surface exists
- extraction implementation exists with env-selectable Ollama/OpenAI/Gemini providers
- project context and approved project task memory are included in extraction prompts
- reviewed artifacts can be approved and used to propose project context updates

## 4. 3rd-Party Integration

The backend must sync approved action items into external systems after user review.

Target responsibility:

- use each user's stored Notion integration settings
- create or update Notion database items only after user approval
- track sync state on local `ActionItem` records
- keep external integration concerns isolated from core meeting logic

Current code status:

- Notion integration status surface exists
- actual Notion sync implementation is not yet built

## Database Architecture Summary

The core Prisma models in this module are:

- **User**
  - local application user record
  - mapped to Clerk via `clerkId`
  - stores Notion integration fields such as `notionToken` and `notionDbId`
- **Meeting**
  - aggregate root for a captured meeting session
  - stores title, description, status, audio location, and generated summary
- **SpeakerProfile**
  - maps AI-generated speaker labels to human-readable names for review
- **TranscriptSegment**
  - timestamped diarized transcript fragments associated with a meeting and speaker
- **ActionItem**
  - extracted task candidates associated with a meeting
  - supports assignee linkage, deadline fields, and Notion sync state

## Module Boundaries

This backend must stay within the orchestrator boundary.

What belongs here:

- API and WebSocket entry points
- auth verification
- persistence
- worker orchestration
- integration orchestration
- structured validation and logging

What does not belong here:

- browser capture logic
- dashboard UI logic
- direct ML inference
- support for Zoom or Microsoft Teams
- support for Jira or Trello in the MVP

## MVP Constraints

These are hard system constraints for this module:

- **Meeting platform:** Google Meet only
- **Authentication provider:** Clerk only
- **Task destination:** Notion only
- **Audio input shape:** single mixed audio stream from Chrome capture
- **Worker expectation:** the Python AI Worker handles transcription and diarization
- **Avoid over-engineering:** do not add unrelated analytics, translation, sentiment, or multi-platform abstractions

## Current Backend Module Structure

Key directories and entry points:

- `src/main.ts`
  - Nest bootstrap, Swagger, Helmet, global validation, CORS
- `src/app.module.ts`
  - top-level module composition
- `src/common/logger/`
  - Winston logger module and production rotation config
- `src/database/prisma.service.ts`
  - Prisma client wiring for PostgreSQL
- `src/modules/clerk/`
  - webhook sync, REST auth guard, session verification, auth endpoint
- `src/modules/audio-stream/`
  - Socket.IO gateway and stream service
- `src/modules/llm/`
  - LLM provider status and future extraction orchestration
- `src/modules/notion/`
  - Notion integration status and future sync logic
- `prisma/schema.prisma`
  - canonical backend data model

## Current Implementation Snapshot

Implemented now:

- NestJS scaffold and module wiring
- configuration loading and Joi-based env validation
- Winston logging integration
- Swagger documentation setup
- global exception filter and validation pipe setup
- health endpoint
- Prisma schema and migrations
- Clerk webhook verification and user synchronization
- global REST auth guard for Clerk session tokens
- authenticated `GET /api/auth/me`
- Socket.IO handshake authentication using Clerk token verification
- LLM artifact extraction with local Ollama/Qwen support and cloud provider alternatives
- project-memory-aware extraction prompts, editable meeting review APIs, artifact approval, and project-context update proposal storage

Not implemented yet:

- real audio chunk buffering and meeting-state persistence
- forwarding audio or chunk batches to the Python AI Worker
- transcript ingestion from the worker
- Notion sync execution
- full end-to-end meeting lifecycle orchestration

## Guidance For Future Work

When extending this module:

- keep controllers thin and move business logic into services
- keep database access in service or infrastructure layers, not in controllers
- treat Clerk as the only source of truth for authentication
- treat the Python worker as the only source of truth for ML inference
- persist state transitions explicitly rather than hiding orchestration in temporary in-memory flows
- prefer structured logs and typed DTOs over ad hoc payload handling
- do not widen scope beyond Google Meet, Clerk, Notion, and the defined MVP flow unless explicitly requested

## Useful Commands

```bash
pnpm lint
pnpm build
pnpm test
pnpm start:dev
```

## Source Of Truth Rule

If a future plan, branch, or external note conflicts with this file, verify the actual code in `kapter-backend/` before changing behavior. This document should track the real implemented architecture of the backend module, not an aspirational design alone.
