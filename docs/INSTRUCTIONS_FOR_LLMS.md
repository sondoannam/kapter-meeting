# SYSTEM CONTEXT: Kapter - AI Meeting Assistant

## 1. PROJECT OVERVIEW

**Name:** Kapter
**Goal:** An AI-powered meeting assistant for small tech teams that captures Google Meet audio, performs real-time/post-meeting Speech-to-Text (STT) and Speaker Diarization, extracts action items via LLM, and syncs them to Notion with a "Human-in-the-loop" review process.

## 2. SYSTEM ARCHITECTURE & TECH STACK

The project follows a Multi-client Microservices architecture within a Lean Monorepo (PNPM Workspaces for JS/TS, isolated virtual env for Python).

- **Capture Client (Chrome Extension):** React, Vite, TailwindCSS (Manifest V3). Responsible solely for capturing mixed audio from Google Meet and streaming it via WebSockets.
- **Management Client (Web Dashboard):** React, Vite, TailwindCSS, Shadcn/UI. The main user interface for reviewing summaries, re-assigning tasks, and syncing to Notion.
- **Backend Orchestrator (API Server):** NestJS, Socket.io, Prisma (PostgreSQL). Acts as the central gateway, managing WebSockets, database states, Clerk webhook syncs, and 3rd-party API calls (Notion, LLM).
- **Core AI Worker (Processing Engine):** Python 3.11+, FastAPI, `faster-whisper` (ASR), `pyannote.audio` (Diarization). Strictly handles ML inference.

## 3. CORE DATA & USER FLOW (END-TO-END)

1.  **Auth & Setup:** User logs into the Web Dashboard via **Clerk**. Extension retrieves the Clerk session token via Content Script and saves it to `chrome.storage.local`.
2.  **Audio Capture:** User joins Google Meet and clicks "Record" on the Extension. Extension streams audio chunks (binary) to the NestJS WebSocket Gateway.
3.  **Processing:** NestJS buffers the audio and passes it to the Python AI Worker. The worker returns a diarized transcript (timestamp + speaker label + text).
4.  **LLM Extraction:** NestJS sends the diarized transcript to an LLM (OpenAI/Gemini) to extract a Summary and Action Items (strictly structured JSON).
5.  **Hand-off:** User stops recording. Extension opens a new tab to the Web Dashboard (`/meeting/[meeting_id]`).
6.  **Human-in-the-loop & Sync:** User reviews the AI-generated Action Items on the Dashboard, maps "Speaker X" to actual team members, and clicks "Sync to Notion". NestJS uses the user's Notion OAuth token to create database pages.

## 4. MVP SCOPE & CONSTRAINTS (STRICT)

- **Supported Platform:** Google Meet ONLY. (Do not write code for Zoom/Teams).
- **Target Output:** Notion Database ONLY. (Do not write code for Jira/Trello).
- **Authentication:** Clerk ONLY.
- **Audio Input:** Mixed audio from Chrome `tabCapture`. The AI Worker must handle Speaker Diarization from a single mixed audio stream.
- **Out of Scope:** Sentiment analysis, real-time translation, complex overlapped speech separation. Focus strictly on STT + Diarization + Action Item Extraction.

## 5. AI AGENT DIRECTIVES (YOUR ROLE)

As the AI Coding Agent assisting with this project, you must:

1.  **Respect the Tech Stack:** Never suggest alternative frameworks (e.g., do not suggest Express instead of NestJS, or Flask instead of FastAPI) unless explicitly asked.
2.  **Write Production-Ready Code:** Implement robust error handling, proper TypeScript typing, and security best practices (CORS, Helmet, input validation).
3.  **Follow the Lean Monorepo Structure:** Keep the boundaries between the 4 modules (extension, web, backend, ai-worker) strictly decoupled.
4.  **No Over-engineering:** Stick to the MVP scope. If a feature is not mentioned in the flow above, do not implement it.
5.  **Think Before Coding:** For complex integrations (e.g., Clerk Webhooks, Audio Chunking), provide a brief Technical Design/Plan before outputting large blocks of code.
