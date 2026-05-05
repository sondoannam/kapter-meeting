# Kapter

Kapter is an AI meeting assistant for small tech teams. The current monorepo combines a Chrome extension for Google Meet capture, a React dashboard for Clerk-authenticated review workflows, a NestJS backend orchestrator, and a Python AI worker for transcription plus speaker diarization.

## Current End-To-End Scope

The current repo supports this testable slice:

- sign in through Clerk in the web dashboard
- bridge the Clerk session from the dashboard into the extension
- stream Google Meet capture from the extension to the backend over Socket.IO
- forward buffered audio batches from the backend to the Python worker
- persist meeting state and transcript segments in the backend
- extract LLM-generated summaries and action items in the backend
- review meeting detail, approve artifacts, and manage project memory in the dashboard
- configure per-project Notion destinations and execute backend Notion task sync for approved items
- view the active session and meeting history in the dashboard

The following pieces are not finished yet:

- the final explicit dashboard-triggered `Sync to Notion` action in the meeting detail page
- full end-to-end stabilization across extension, backend, worker, and dashboard in one local flow

## Monorepo Layout

```text
A20-App-015/
├── kapter-extension/   Chrome extension capture client
├── kapter-webapp/      React dashboard and Clerk token bridge
├── kapter-backend/     NestJS orchestrator and Socket.IO gateway
├── kapter-ai-worker/   Python FastAPI inference worker
├── libs/contracts/     Shared TypeScript contracts package
├── infra/              Shared local infrastructure files
├── docs/               Architecture, scope, and progress docs
└── scripts/            AI logging and repo utilities
```

## Local Full-Stack Workflow

The recommended workflow is now simple: every teammate runs the full stack on their own computer.

Each machine should run:

- PostgreSQL, either from `infra/postgres.docker-compose.yml` or from a managed cloud database
- `kapter-ai-worker`
- `kapter-backend`
- `kapter-webapp`
- `kapter-extension`

For local development, the standard ports are:

- PostgreSQL: `5433`
- AI worker: `8000`
- backend: `3001`
- webapp: `5173`

The extension should point to the teammate's own local webapp and backend, not to a shared remote URL.

For the hosted MVP topology (`kapter-webapp` on Vercel, `kapter-backend` on Heroku, local `kapter-ai-worker` over Cloudflare Tunnel), see `docs/deployment-mvp-vercel-heroku-cloudflared.md`.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Google Chrome
- Python 3.11+
- Docker Desktop if you want to run Postgres locally in a container
- access to the project Clerk instance

Optional but recommended:

- FFmpeg shared build on Windows if the AI worker will run with real models
- a personal tunnel if you want Clerk webhooks to reach your local backend directly

## Initial Setup

Clone the repo and install JS dependencies once at the workspace root.

```bash
git clone <repo-url>
cd A20-App-015
pnpm install
pnpm --filter @kapter/contracts build
```

Optional but recommended for contributors:

```bash
bash scripts/setup_hooks.sh
```

## Environment Setup

Each teammate should configure every local module on their own machine.

### 1. Shared JS workspace setup

Build the shared contracts package once after install, and again whenever the contracts change.

```bash
pnpm --filter @kapter/contracts build
```

### 2. Database

You have two supported options for PostgreSQL.

#### Option A: local Postgres with Docker

Create `infra/.env` from `infra/.env.example` if it does not exist yet.

Default values:

```dotenv
POSTGRES_PORT=5433
POSTGRES_USER=admin
POSTGRES_PASSWORD=Test@123
POSTGRES_DB=kapter_db
```

Start Postgres:

```bash
docker compose --env-file infra/.env -f infra/postgres.docker-compose.yml up -d
```

#### Option B: managed cloud Postgres, no Docker

If you already have a hosted Postgres database from Neon, Supabase, Railway, Render, or another provider, you can skip Docker completely.

In that case:

- do not start `infra/postgres.docker-compose.yml`
- set `DATABASE_URL` in `kapter-backend/.env` to your hosted Postgres connection string
- make sure the database is reachable from your local backend process

Example shape:

```dotenv
DATABASE_URL=postgresql://username:password@db-host.example.com:5432/kapter_db?schema=public
```

If your password contains special characters, URL-encode it just like the local example does with `Test@123` -> `Test%40123`.

### 3. Web dashboard

Create `kapter-webapp/.env` with values equivalent to:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_with_the_project_publishable_key
VITE_API_URL=http://localhost:3001
VITE_CLERK_EXTENSION_TOKEN_TEMPLATE=kapter-extension
```

Notes:

- `VITE_API_URL` should point to the teammate's own local backend.
- the Clerk publishable key must match the project Clerk app.

Start the dashboard:

```bash
cd kapter-webapp
pnpm dev
```

The dashboard will be available at:

```text
http://localhost:5173
```

### 4. Extension

Create `kapter-extension/.env` with values equivalent to:

```dotenv
VITE_WEBAPP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_DEBUG=true
```

Notes:

- `VITE_WEBAPP_URL` must point to the teammate's own local dashboard.
- `VITE_API_URL` and `VITE_WS_URL` must point to the teammate's own local backend.

Start the extension build watcher:

```bash
cd kapter-extension
pnpm dev
```

Then load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `kapter-extension/dist`.

### 5. AI worker

The repo expects a module-local virtual environment at `kapter-ai-worker/.venv`. If it does not exist on a teammate's machine yet, create it once and reuse it.

Example on Windows PowerShell:

```powershell
cd kapter-ai-worker
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `kapter-ai-worker/.env` from `kapter-ai-worker/.env.example`.

For the easiest local E2E boot, keep mock mode enabled:

```dotenv
KAPTER_AI_USE_REAL_MODELS=false
KAPTER_AI_DEVICE=cpu
```

If you want real inference instead of mock output, update at least these values:

```dotenv
KAPTER_AI_USE_REAL_MODELS=true
KAPTER_AI_HF_TOKEN=hf_your_token_here
KAPTER_AI_DEVICE=cuda
KAPTER_AI_FFMPEG_BIN=C:\path\to\ffmpeg\bin
```

Start the worker:

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe server.py
```

The worker serves:

- `GET /health`
- `POST /api/v1/process-audio`

at:

```text
http://127.0.0.1:8000
```

### 6. Backend

Create `kapter-backend/.env` from `kapter-backend/.env.example`.

Minimum values to review before starting:

```dotenv
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
CLERK_SECRET_KEY=sk_test_replace_me
CLERK_WEBHOOK_SIGNING_SECRET=whsec_replace_me
CLERK_JWT_KEY=
CLERK_AUTHORIZED_PARTIES=http://localhost:3000,http://localhost:5173
DATABASE_URL=postgresql://admin:Test%40123@localhost:5433/kapter_db?schema=public
AI_WORKER_BASE_URL=http://127.0.0.1:8000
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_OAUTH_REDIRECT_URI=http://localhost:3001/api/notion/callback
```

Notes:

- Notion setup now uses OAuth app credentials instead of a single static API key.
- If you are not testing Notion yet, the OAuth values can stay as placeholders until you need the connect-and-sync flow.
- `AI_WORKER_BASE_URL` should stay local for the standard teammate workflow.
- `DATABASE_URL` can point either to the local Postgres container on port `5433` or to a managed cloud Postgres instance.

Start the backend:

```bash
cd kapter-backend
pnpm start:dev
```

### 7. Optional: local tunnel for Clerk webhook delivery

You do not need a public backend URL for the basic local extension -> backend -> worker -> dashboard loop.

If a teammate wants to test Clerk webhook delivery end-to-end on their own machine, they need to expose their local backend themselves and point Clerk at that public URL. The repo does not require a specific tunneling provider for this.

Without a personal tunnel:

- dashboard sign-in can still work locally
- the backend can still serve local APIs
- the extension can still stream to the local backend
- Clerk webhook events just will not reach that local machine directly

## Local E2E Test Flow

Once PostgreSQL, the worker, the backend, the dashboard, and the extension are all running on the same machine:

1. Open `http://localhost:5173` and sign in with Clerk.
2. Open the extension popup and start the secure token bridge if the extension is disconnected.
3. Wait for the `/extension-bridge` page to confirm the token handoff.
4. Join a Google Meet session.
5. Start recording from the extension.
6. Confirm that the dashboard shows an active meeting banner.
7. Stop recording from the extension.
8. Refresh the dashboard and confirm the meeting appears in history.

## Startup Order Summary

Use this order on a fresh machine:

1. Choose a database option: either local Docker Postgres with `docker compose --env-file infra/.env -f infra/postgres.docker-compose.yml up -d` or a managed cloud Postgres URL in `kapter-backend/.env`.
2. `.venv\Scripts\python.exe server.py` inside `kapter-ai-worker`
3. `pnpm start:dev` inside `kapter-backend`
4. `pnpm dev` inside `kapter-webapp`
5. `pnpm dev` inside `kapter-extension`
6. Load `kapter-extension/dist` into Chrome

## Useful Commands

### Workspace root

```bash
pnpm --filter @kapter/contracts build
pnpm build
pnpm lint
pnpm typecheck
```

### Webapp

```bash
cd kapter-webapp
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

### Extension

```bash
cd kapter-extension
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

### Backend

```bash
cd kapter-backend
pnpm start:dev
pnpm build
pnpm lint
pnpm typecheck
```

### AI worker

```powershell
cd kapter-ai-worker
.venv\Scripts\python.exe server.py
.venv\Scripts\python.exe -m pytest tests/test_process_audio_endpoint.py -q
```

## Known Limitations

- The dashboard now includes meeting review and project-memory approval flows, but the final explicit meeting-page sync button for Notion is still being wired.
- Backend Notion sync exists for approved items, but the full dashboard-triggered end-to-end path is still being finalized.
- Some backend build and full-suite verification paths are currently blocked by unrelated extraction-pipeline Prisma/type issues outside the Notion sync slice.
- If you use a managed cloud Postgres instance, the README assumes you already have a valid connection string and network access configured for your local backend process.

## Project Notes

### Journal

Update [JOURNAL.md](./JOURNAL.md) at the end of every week with:

- features shipped
- AI tools used and how they helped
- the hardest problem of the week and how it was solved
- what you would do differently next week
- the plan for next week

### Worklog

Update [WORKLOG.md](./WORKLOG.md) whenever the team makes an important technical decision, changes direction, or resolves a significant bug.

### AI logging

Prompts and tool calls are logged automatically through the repo hooks once `scripts/setup_hooks.sh` has been run. See [AGENTS.md](./AGENTS.md) for the policy details.
