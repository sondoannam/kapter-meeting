# Kapter Architecture Evolution: From Transcription Tool to Contextual Memory Engine

## 1. System Overview & Context

**Project Name:** Kapter
**Target Persona:** Small Tech Teams (Agile, Startups, Indie Hackers).
**Core Problem:** Meeting notes and action items often lose context over time, leading to "project amnesia" where technical decisions and project states are forgotten or misaligned across multiple sessions.

---

## 2. Phase 1 Assessment: The Linear Transcription Pipeline

The initial architecture focused on a single-session flow:

1. **Capture:** Chrome Extension captures audio chunks.
2. **Buffer:** NestJS Backend aggregates chunks and forwards to AI Worker.
3. **Inference:** Python AI Worker performs STT (Faster-Whisper) and Diarization (Pyannote).
4. **Dashboard:** Displays real-time/post-meeting transcript.
5. **Extraction:** LLM extracts Summary and Action Items from a single transcript.
6. **Sync:** Manual/Automatic sync to a generic Notion database.

### Limitations of Phase 1:

- **Context Isolation:** Each meeting is treated as an isolated island. LLM has no "memory" of previous decisions.
- **Task Ambiguity:** Action items lack deep context (e.g., "Fix auth bug" without knowing the specific tech stack discussed previously).
- **Manual Overhead:** High documentation debt as teams must manually update project goals and ADRs (Architecture Decision Records).

---

## 3. Phase 2 Evolution: The Contextual Memory Engine

The project evolved to include a **Project-centric** model, where a single Project spans multiple Meetings.

### The Dual-Memory System:

- **Strategic Memory (Project Context):** A high-level Markdown/JSON file stored in PostgreSQL containing project goals, tech stack, architectural decisions, and "rejected" ideas.
- **Tactical Memory (Active Tasks):** The current state of all Action Items (TODO, In Progress, Done) retrieved directly from the database.

### Why this is more effective:

- **Enhanced Accuracy:** LLM uses the Strategic Memory to understand project-specific jargon and rules before summarizing.
- **Decision Continuity:** LLM recognizes when a new decision contradicts or updates a previous one, prompting a Project Context update.
- **Reduced Hallucination:** By feeding active tasks into the prompt, LLM avoids duplicating existing action items.

---

## 4. Technical Architecture Decisions

### Orchestration: NestJS vs. Python

- **Decision:** LLM Orchestration and Agentic Logic (LangGraph/LangChain) will be handled by **NestJS (TypeScript)**.
- **Rationale:**
  - **Leanness:** Avoids creating a new Python microservice for I/O-bound LLM calls.
  - **Type Safety:** Shared contracts across Web, Extension, and Backend.
  - **Direct Access:** NestJS has direct access to Prisma (Postgres) for retrieving state and active tasks.
- **AI Worker Role:** The Python module remains strictly for **Compute-bound ML Inference** (ASR/Diarization).

### State Management: PostgreSQL

- **Storage Strategy:** Use PostgreSQL for both relational data (Meetings/Tasks) and unstructured state (Markdown/JSON for Project Context).
- **Future-proofing:** Allows for adding `pgvector` later if RAG is needed for extremely large project histories.

---

## 5. Implementation & User Flow

### Step-by-Step Workflow:

1. **Initiation:** User picks an existing Project or creates a new one in the Extension/Dashboard.
2. **Capture & Processing:** Standard Phase 1 flow continues (Whisper/Pyannote).
3. **Thinking (Dual-Memory Prompting):**
   - NestJS fetches **Project Context** (Markdown) + **Active Tasks** (JSON).
   - NestJS sends context + current transcript to LLM.
4. **Human-in-the-Loop (HITL) - Phase 1:** User reviews/edits Action Items.
5. **Thinking (State Update):** After Action Item approval, LLM analyzes the session to propose updates to the **Project Context**.
6. **Human-in-the-Loop (HITL) - Phase 2:** User reviews/edits the proposed changes to the Project Context (can be skipped).
7. **Sync:** Approved tasks are pushed to the **Project-specific Notion Database**.

### Notion Integration Strategy:

- **OAuth Flow:** User connects Notion account once.
- **Automated Hierarchy:** When a Kapter Project is created, a corresponding **Notion Database** (or Page) is automatically generated within a user-selected Parent Page.
- **Lifecycle Tracking:** `ActionItem.isSynced` tracks the status of each task to prevent duplicates.

---

## 6. Implementation Roadmap

### Parallel Steps (Immediate):

- **Track A (Backend):** Update Prisma schema to include `Project` and `ProjectContext` fields. Implement LangGraph logic in NestJS LLM Service.
- **Track B (Frontend):** Build the Dual-column Review UI (Tasks on left, Context updates on right).
- **Track C (Integration):** Implement Notion OAuth and the database creation service.

### Sequential Dependencies:

- Finalize the **LLM Prompt Schema** for Strategic Memory updates before completing the HITL UI.
- Stabilize the **Prisma Project table** before migrating existing Meeting records.

---
