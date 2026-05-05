#!/usr/bin/env python3
"""
Shared AI hook logger — works with Claude Code, Gemini CLI, Codex, Cursor, Copilot.
Reads JSON from stdin, normalizes to common format, appends to .ai-log/session.jsonl
"""
import json
import os
import sys
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency in hooks
    load_dotenv = None

VN_TZ = timezone(timedelta(hours=7))


def git(*args: str, cwd=None) -> str:
    try:
        return subprocess.check_output(
            list(args),
            shell=False,
            text=True,
            stderr=subprocess.DEVNULL,
            cwd=cwd,
        ).strip()
    except Exception:
        return ""


def detect_repo_name(repo_root: Path) -> str:
    remote_url = git("git", "remote", "get-url", "origin", cwd=repo_root).strip()
    if remote_url:
        normalized = remote_url.rstrip("/").replace("\\", "/")
        if "://" not in normalized and ":" in normalized:
            normalized = normalized.split(":", 1)[1]
        repo_name = normalized.rsplit("/", 1)[-1]
        if repo_name:
            return repo_name.removesuffix(".git")
    return repo_root.name


def detect_repo_root(data: dict) -> Path:
    session_cwd = data.get("cwd") or os.getcwd()
    repo_root = git("git", "rev-parse", "--show-toplevel", cwd=session_cwd)
    if repo_root:
        return Path(repo_root)
    return Path(__file__).resolve().parent.parent


def resolve_log_dir(repo_root: Path) -> Path:
    if load_dotenv is not None:
        load_dotenv(repo_root / ".env", override=False)

    log_dir_value = os.environ.get("AI_LOG_DIR", ".ai-log")
    log_dir = Path(log_dir_value)
    if not log_dir.is_absolute():
        log_dir = repo_root / log_dir
    return log_dir


def detect_tool(data: dict) -> str:
    """Detect which AI tool sent this hook event."""
    tool_env = os.environ.get("AI_TOOL_NAME", "").lower()
    if tool_env:
        return tool_env
    # Heuristics
    if "transcript_path" in data:
        return "codex"
    if data.get("hook_event_name", "").startswith(("Before", "After", "Session", "Pre", "Notification")):
        return "gemini"
    if data.get("hook_event_name", "")[0:1].islower():
        # camelCase event names → Cursor or Copilot
        if "workspace_roots" in data:
            return "cursor"
        if "toolName" in data:
            return "copilot"
    if "hook_event_name" in data:
        return "claude"
    return "unknown"


def normalize(data: dict, tool: str) -> dict | None:
    """Normalize tool-specific payload to common log entry."""
    event = data.get("hook_event_name") or data.get("event", "")
    ts = datetime.now(VN_TZ).isoformat()
    repo_root = detect_repo_root(data)

    base = {
        "ts": ts,
        "tool": tool,
        "event": event,
        "session_id": (
            data.get("session_id") or
            data.get("conversation_id") or
            data.get("generation_id") or ""
        ),
        "model": data.get("model", ""),
        "repo": detect_repo_name(repo_root),
        "branch": git("git", "rev-parse", "--abbrev-ref", "HEAD", cwd=repo_root),
        "commit": git("git", "rev-parse", "--short", "HEAD", cwd=repo_root),
        "student": git("git", "config", "user.email", cwd=repo_root),
    }

    if tool == "claude":
        prompt = ""
        # UserPromptSubmit: prompt is at top level
        if event == "UserPromptSubmit":
            prompt = data.get("prompt", "")[:1000]
        # PostToolUse: extract from tool_input
        elif isinstance(data.get("tool_input"), dict):
            prompt = data["tool_input"].get("prompt") or data["tool_input"].get("content") or ""
        base.update({
            "prompt": prompt,
            "tool_name": data.get("tool_name", ""),
            "tool_input": data.get("tool_input") if event != "UserPromptSubmit" else None,
            "tool_response": str(data.get("tool_response", ""))[:500],
        })

    elif tool == "gemini":
        if event == "BeforeAgent":
            prompt = data.get("prompt", "")[:1000]
            base.update({"prompt": prompt})
        else:
            req = data.get("request", {})
            contents = req.get("contents", [])
            prompt = ""
            for c in reversed(contents):
                for part in c.get("parts", []):
                    if part.get("text"):
                        prompt = part["text"][:1000]
                        break
                if prompt:
                    break
            resp = data.get("response", {})
            answer = ""
            try:
                answer = resp["candidates"][0]["content"]["parts"][0]["text"][:500]
            except Exception:
                pass
            base.update({"prompt": prompt, "response_summary": answer})

    elif tool == "codex":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "turn_id": data.get("turn_id", ""),
            "transcript_path": data.get("transcript_path", ""),
        })

    elif tool == "cursor":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "files_context": data.get("attachments", []),
        })

    elif tool == "copilot":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "tool_name": data.get("toolName", ""),
            "tool_args": data.get("toolArgs"),
        })

    # Skip empty/noise events
    if not base.get("prompt") and event not in ("Stop", "stop", "SessionEnd", "sessionEnd", "AfterModel"):
        return None

    return base


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        sys.exit(0)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    tool = detect_tool(data)
    entry = normalize(data, tool)
    if not entry:
        sys.exit(0)

    repo_root = detect_repo_root(data)
    log_dir = resolve_log_dir(repo_root)
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "session.jsonl"

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # Output valid JSON (required by some tools like Gemini)
    print(json.dumps({"status": "logged"}))


if __name__ == "__main__":
    main()
