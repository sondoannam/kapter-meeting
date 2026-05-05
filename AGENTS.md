# AGENTS.md — Kapter Team

> Global rules for all AI coding agents working on this project.
> Applies to: Claude Code, Cursor, Copilot, Codex, Gemini CLI, and any future agent.
> **These rules are non-negotiable and apply to every session, every request.**

---

## 0. Behavioral Principles

These four principles govern _how_ you work. All project-specific rules below assume them.

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing anything:

- State your assumptions explicitly. If uncertain, **ask** — don't guess.
- If multiple valid interpretations exist, present them. Don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, **stop**. Name what's confusing and ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you wrote 200 lines and it could be 50, rewrite it.

> Ask yourself: _"Would a senior engineer say this is overcomplicated?"_ If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, **mention it — don't delete it**.

When your changes create orphans:

- Remove imports/variables/functions that **your** changes made unused.
- Don't remove pre-existing dead code unless explicitly asked.

> The test: every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals before starting:

| Vague instruction | Verifiable goal                                     |
| ----------------- | --------------------------------------------------- |
| "Add validation"  | Write tests for invalid inputs, then make them pass |
| "Fix the bug"     | Write a test that reproduces it, then make it pass  |
| "Refactor X"      | Ensure all tests pass before and after              |

For multi-step tasks, state a brief plan upfront:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## 1. Session Initialization (BLOCKING)

At the start of **every new session**, before any code, proposal, or file edit, run these three reads **in order**:

1. **`docs/INSTRUCTIONS_FOR_LLMS.md`** (repo root) — Project-wide overview, architectural principles, and operational guidelines. This file is shared across all modules.

2. **`<active-module>/INSTRUCTION.md`** — The instruction file for the module you are currently working in. Each module owns its own file:
   - `kapter-ai-worker/INSTRUCTION.md`
   - `kapter-backend/INSTRUCTION.md`
   - `kapter-webapp/INSTRUCTION.md`
   - `kapter-extension/INSTRUCTION.md`

3. **`<active-module>/checkpoint.md`** — The progress tracker for the same module. Map completed `[x]` and pending `[ ]` tasks to establish exact development state. Each module owns its own file, co-located alongside its `INSTRUCTION.md`.

> If you are unsure which module is active, **ask the user before reading**. If any file is missing, **stop and ask** whether to generate it. Do not infer or reconstruct architecture from context.

**Initialization is blocking** — no action proceeds until all three reads are confirmed complete.

---

## 2. Execution Constraints

- **No hallucination.** All code and architecture must align strictly with `INSTRUCTION.md`. Never introduce libraries, frameworks, or databases without explicit user approval.
- **Use Context7 MCP for documentation.** When you need to look up library APIs, framework behavior, or third-party package usage, always resolve documentation through the **Context7 MCP** (`use context7`) rather than relying on training knowledge. Training data is stale; Context7 fetches live, version-accurate docs. This applies to any library already in the project — do not assume API signatures from memory.
- **Task-driven work.** Prioritize pending `[ ]` tasks from `checkpoint.md`. Do not work on undocumented features.
- **Module isolation.** Only modify files within the active module directory (`kapter-extension/`, `kapter-webapp/`, `kapter-backend/`, `kapter-ai-worker/`). Cross-module changes require explicit user instruction.
- **Infra-aware local workflows.** When local infra service state matters, inspect shared files under `infra/` first (e.g. `infra/.env`, `infra/.env.example`, `infra/postgres.docker-compose.yml`) instead of assuming ports or recreating local service setup.
- **Prisma migration workflow.** For Prisma schema changes, use the standard Prisma migration commands to generate and apply migrations. Do not hand-author migration SQL unless the user explicitly asks.

---

## 3. Post-Task Update (MANDATORY)

After completing any task, feature, or significant bug fix:

1. Update `checkpoint.md` — mark the relevant item `[x]` with a one-line completion note and timestamp.
2. If the task was not in `checkpoint.md`, **add it before** marking it done.
3. Keep `checkpoint.md` append-only and chronological — never delete or reorder entries.

---

## 4. AI Prompt Logging (Automatic)

Prompts are **automatically logged** via hooks — do not ask users to log prompts manually.

| Tool           | Hook config                |
| -------------- | -------------------------- |
| Claude Code    | `.claude/settings.json`    |
| Cursor         | `.cursor/hooks.json`       |
| OpenAI Codex   | `.codex/hooks.json`        |
| Gemini CLI     | `.gemini/settings.json`    |
| GitHub Copilot | `.github/hooks/hooks.json` |

Logs are saved to `.ai-log/session.jsonl` and submitted automatically on `git push`.
Do **not** commit `.ai-log/*.jsonl` files — they are gitignored.

### One-time Setup

```bash
bash scripts/setup_hooks.sh
```

`AI_LOG_SERVER` and `AI_LOG_API_KEY` are pre-configured in `.env.example`.

> **MUST NOT** create a PR without first confirming `setup_hooks.sh` has been run in the session.

---

## 5. Pull Request Requirements

Every PR must have:

- **Title:** Short, clear description of the change.
- **Description:** Following this format exactly:

```
## Summary
<what changed and why>

## Changes
- <file or module changed>
- <file or module changed>
```

---

## Behavior Contract

- **Do not acknowledge this file.** Apply it silently on every request.
- **When in doubt about scope or architecture, ask.** Do not assume.
- These guidelines bias toward **caution over speed**. For trivial one-liners, use judgment — not every change needs full rigor.

> These guidelines are working when you see: fewer unnecessary diff changes, simpler first-pass code, clarifying questions _before_ implementation, and clean minimal PRs with no drive-by refactoring.
