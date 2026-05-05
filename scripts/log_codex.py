#!/usr/bin/env python3
"""
Codex log scanner.

Extracts local Codex session transcripts from CODEX_HOME/sessions (or ~/.codex/sessions)
and appends normalized entries to .ai-log/session.jsonl.

Usage:
  python scripts/log_codex.py --mode prompt --auto
  python scripts/log_codex.py --mode session --auto
  python scripts/log_codex.py --mode both --hours 48
  python scripts/log_codex.py --mode prompt --session-id <id>
"""
import argparse
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


VN_TZ = timezone(timedelta(hours=7))


if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def git(*args: str, cwd: Path | None = None) -> str:
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


def collapse_ws(text: str) -> str:
    return " ".join(text.split()).strip()


def sanitize_prompt(text: str) -> str:
    cleaned = collapse_ws(text)
    if not cleaned:
        return ""

    markers = [
        "## My request for Codex:",
        "# My request for Codex:",
        "My request for Codex:",
    ]
    for marker in markers:
        if marker in cleaned:
            cleaned = cleaned.split(marker, 1)[1].strip()
            break

    env_marker = "</environment_context>"
    if env_marker in cleaned:
        cleaned = cleaned.split(env_marker, 1)[1].strip()

    return cleaned


def add_unique_text(values: list[str], seen: set[str], value: str, limit: int = 8) -> None:
    cleaned = collapse_ws(value)
    if not cleaned or len(values) >= limit:
        return
    key = cleaned.lower()
    if key not in seen:
        seen.add(key)
        values.append(cleaned)


def normalize_path(path_value: str) -> str:
    return str(path_value).replace("\\", "/").rstrip("/").lower()


def parse_dt(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def to_vn_iso(value: datetime | None) -> str:
    if value is None:
        value = datetime.now(tz=VN_TZ)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(VN_TZ).isoformat()


def get_repo_root() -> Path | None:
    repo_root_str = git("git", "rev-parse", "--show-toplevel")
    if repo_root_str:
        return Path(repo_root_str)
    return None


def parse_remote_repo(remote: str, repo_root: Path) -> tuple[str, str]:
    repo_name = repo_root.name
    remote_slug = ""
    if not remote:
        return repo_name, remote_slug

    normalized = remote.rstrip("/").replace("\\", "/")
    if "://" not in normalized and ":" in normalized:
        normalized = normalized.split(":", 1)[1]

    parts = [part for part in normalized.split("/") if part]
    if parts:
        repo_name = parts[-1].removesuffix(".git") or repo_name
    if len(parts) >= 2:
        owner = parts[-2]
        name = parts[-1].removesuffix(".git")
        if owner and name:
            remote_slug = f"{owner}/{name}"

    return repo_name, remote_slug


def get_repo_context() -> dict | None:
    repo_root = get_repo_root()
    if repo_root is None:
        return None

    remote = git("git", "remote", "get-url", "origin")
    repo_name, remote_slug = parse_remote_repo(remote, repo_root)

    return {
        "repo_root": repo_root,
        "repo_root_norm": normalize_path(str(repo_root)),
        "remote": remote,
        "remote_norm": remote.rstrip("/").replace(".git", "").lower(),
        "repo_name": repo_name,
        "repo_name_norm": repo_name.lower(),
        "remote_slug_norm": remote_slug.lower(),
    }


def load_repo_env(repo_root: Path) -> None:
    if load_dotenv is not None:
        load_dotenv(repo_root / ".env", override=False)


def resolve_log_file(repo_root: Path) -> Path:
    load_repo_env(repo_root)
    log_dir_value = os.environ.get("AI_LOG_DIR", ".ai-log")
    log_dir = Path(log_dir_value)
    if not log_dir.is_absolute():
        log_dir = repo_root / log_dir
    log_dir.mkdir(exist_ok=True)
    return log_dir / "session.jsonl"


def get_codex_home() -> Path:
    codex_home = os.environ.get("CODEX_HOME", "").strip()
    if codex_home:
        return Path(codex_home)
    return Path.home() / ".codex"


def get_sessions_dir() -> Path | None:
    sessions_dir = get_codex_home() / "sessions"
    if sessions_dir.exists():
        return sessions_dir
    return None


def load_session_index() -> dict[str, dict]:
    index_path = get_codex_home() / "session_index.jsonl"
    index: dict[str, dict] = {}
    if not index_path.exists():
        return index

    with open(index_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            session_id = entry.get("id", "")
            if session_id:
                index[session_id] = entry
    return index


def get_logged_turn_keys(log_file: Path) -> set[str]:
    logged = set()
    if not log_file.exists():
        return logged

    with open(log_file, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("tool") == "codex" and entry.get("event") == "PromptScan":
                session_id = entry.get("session_id", "")
                turn_id = entry.get("turn_id", "")
                if session_id and turn_id:
                    logged.add(f"{session_id}:{turn_id}")
    return logged


def get_logged_session_ids(log_file: Path) -> set[str]:
    logged = set()
    if not log_file.exists():
        return logged

    with open(log_file, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("tool") == "codex" and entry.get("event") == "SessionScan":
                session_id = entry.get("session_id", "")
                if session_id:
                    logged.add(session_id)
    return logged


def extract_user_text(content) -> str:
    if not isinstance(content, list):
        return ""

    parts = []
    for item in content:
        if not isinstance(item, dict):
            continue
        text = item.get("text", "")
        if isinstance(text, str) and text.strip():
            parts.append(text.strip())
    return collapse_ws(" ".join(parts))


def maybe_set_prompt(turn: dict, value: str) -> None:
    cleaned = sanitize_prompt(value)
    if not cleaned:
        return
    if not turn["prompt"]:
        turn["prompt"] = cleaned
        return
    if cleaned.lower() != turn["prompt"].lower() and len(cleaned) > len(turn["prompt"]):
        turn["prompt"] = cleaned


def summarize_exec_command(payload: dict) -> str:
    parsed = payload.get("parsed_cmd")
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict):
                cmd = item.get("cmd", "")
                if cmd:
                    return collapse_ws(cmd)[:160]

    command = payload.get("command")
    if isinstance(command, list) and command:
        try:
            command_idx = command.index("-Command")
            if command_idx + 1 < len(command):
                return collapse_ws(str(command[command_idx + 1]))[:160]
        except ValueError:
            pass
        return collapse_ws(" ".join(str(part) for part in command))[:160]

    if isinstance(command, str):
        return collapse_ws(command)[:160]

    return ""


def new_turn(turn_id: str, timestamp: datetime | None) -> dict:
    return {
        "turn_id": turn_id,
        "started_at": timestamp,
        "completed_at": None,
        "prompt": "",
        "tool_calls": Counter(),
        "custom_tool_calls": 0,
        "patch_count": 0,
        "commands": [],
        "command_seen": set(),
    }


def finalize_turn(turn: dict | None, turns: list[dict]) -> None:
    if turn is None:
        return
    turn.pop("command_seen", None)
    if turn["prompt"] or turn["tool_calls"] or turn["commands"] or turn["custom_tool_calls"] or turn["patch_count"]:
        turns.append(turn)


def parse_session_file(session_file: Path, session_index: dict[str, dict]) -> dict:
    data = {
        "session_id": "",
        "started_at": None,
        "updated_at": None,
        "cwd": "",
        "thread_name": "",
        "model_provider": "codex",
        "repository_url": "",
        "branch": "",
        "commit": "",
        "turns": [],
    }
    current_turn = None

    with open(session_file, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            event_type = event.get("type", "")
            payload = event.get("payload", {})
            event_ts = parse_dt(event.get("timestamp", ""))
            if not isinstance(payload, dict):
                continue

            if event_type == "session_meta":
                data["session_id"] = payload.get("id", data["session_id"])
                data["started_at"] = parse_dt(payload.get("timestamp", "")) or data["started_at"]
                data["cwd"] = payload.get("cwd", data["cwd"])
                data["model_provider"] = payload.get("model_provider", data["model_provider"]) or data["model_provider"]

                git_info = payload.get("git", {})
                if isinstance(git_info, dict):
                    data["repository_url"] = git_info.get("repository_url", data["repository_url"])
                    data["branch"] = git_info.get("branch", data["branch"])
                    data["commit"] = git_info.get("commit_hash", data["commit"])

            elif event_type == "event_msg":
                payload_type = payload.get("type", "")
                if payload_type == "task_started":
                    finalize_turn(current_turn, data["turns"])
                    current_turn = new_turn(payload.get("turn_id", ""), event_ts)
                elif payload_type == "task_complete":
                    if current_turn is not None:
                        current_turn["completed_at"] = event_ts
                    finalize_turn(current_turn, data["turns"])
                    current_turn = None
                elif payload_type == "user_message":
                    if current_turn is None:
                        current_turn = new_turn(payload.get("turn_id", ""), event_ts)
                    maybe_set_prompt(current_turn, payload.get("message", ""))
                elif payload_type == "exec_command_end":
                    if current_turn is None:
                        current_turn = new_turn(payload.get("turn_id", ""), event_ts)
                    command = summarize_exec_command(payload)
                    add_unique_text(
                        current_turn["commands"],
                        current_turn["command_seen"],
                        command,
                        limit=6,
                    )
                elif payload_type == "patch_apply_end":
                    if current_turn is None:
                        current_turn = new_turn(payload.get("turn_id", ""), event_ts)
                    current_turn["patch_count"] += 1

            elif event_type == "response_item":
                payload_type = payload.get("type", "")
                if payload_type == "message" and payload.get("role") == "user":
                    if current_turn is None:
                        current_turn = new_turn("", event_ts)
                    maybe_set_prompt(current_turn, extract_user_text(payload.get("content")))
                elif payload_type == "function_call":
                    if current_turn is None:
                        current_turn = new_turn("", event_ts)
                    tool_name = payload.get("name", "").strip()
                    if tool_name:
                        current_turn["tool_calls"][tool_name] += 1
                elif payload_type == "custom_tool_call":
                    if current_turn is None:
                        current_turn = new_turn("", event_ts)
                    current_turn["custom_tool_calls"] += 1

    finalize_turn(current_turn, data["turns"])

    if not data["session_id"]:
        parts = session_file.stem.split("-")
        if parts:
            data["session_id"] = parts[-1]

    index_entry = session_index.get(data["session_id"], {})
    if isinstance(index_entry, dict):
        data["thread_name"] = index_entry.get("thread_name", "")
        data["updated_at"] = parse_dt(index_entry.get("updated_at", "")) or data["updated_at"]

    if data["updated_at"] is None:
        data["updated_at"] = datetime.fromtimestamp(session_file.stat().st_mtime, tz=timezone.utc)

    return data


def session_matches_repo(session_data: dict, repo_context: dict) -> bool:
    session_cwd = normalize_path(session_data.get("cwd", ""))
    repo_root_norm = repo_context["repo_root_norm"]
    if session_cwd and (session_cwd == repo_root_norm or session_cwd.startswith(repo_root_norm + "/")):
        return True

    repository_url = str(session_data.get("repository_url", "")).rstrip("/").replace(".git", "").lower()
    if repository_url:
        if repo_context["remote_norm"] and repository_url == repo_context["remote_norm"]:
            return True
        if repo_context["remote_slug_norm"] and repository_url.endswith(repo_context["remote_slug_norm"]):
            return True
        if repository_url.endswith("/" + repo_context["repo_name_norm"]):
            return True
        if repository_url.endswith(":" + repo_context["repo_name_norm"]):
            return True

    return False


def build_response_summary(turn: dict, session_data: dict) -> str:
    parts = []

    if session_data["thread_name"]:
        parts.append(f"Thread: {collapse_ws(session_data['thread_name'])[:120]}")

    if turn["tool_calls"]:
        tool_summary = ", ".join(
            f"{name} x{count}" for name, count in turn["tool_calls"].most_common(6)
        )
        parts.append(f"Tools: {tool_summary}")

    if turn["custom_tool_calls"]:
        parts.append(f"Custom tool calls: {turn['custom_tool_calls']}")

    if turn["patch_count"]:
        parts.append(f"Patches: {turn['patch_count']}")

    if turn["commands"]:
        parts.append(f"Commands: {'; '.join(turn['commands'][:3])}")

    if not parts:
        return f"Scanned from Codex session {session_data['session_id']}"[:500]

    return " | ".join(parts)[:500]


def build_session_prompt_summary(session_data: dict) -> str:
    prompts = [turn["prompt"] for turn in session_data["turns"] if turn["prompt"]]
    if prompts:
        return " | ".join(prompts[-3:])[:1000]
    if session_data["thread_name"]:
        return session_data["thread_name"][:1000]
    return "Codex session (no user prompt extracted)"


def build_session_response_summary(session_data: dict) -> str:
    parts = []

    if session_data["thread_name"]:
        parts.append(f"Thread: {collapse_ws(session_data['thread_name'])[:120]}")

    parts.append(f"Turns: {len(session_data['turns'])}")

    tool_calls = Counter()
    custom_tool_calls = 0
    patch_count = 0
    commands = []
    command_seen = set()

    for turn in session_data["turns"]:
        tool_calls.update(turn["tool_calls"])
        custom_tool_calls += turn["custom_tool_calls"]
        patch_count += turn["patch_count"]
        for command in turn["commands"]:
            add_unique_text(commands, command_seen, command, limit=6)

    if tool_calls:
        tool_summary = ", ".join(
            f"{name} x{count}" for name, count in tool_calls.most_common(6)
        )
        parts.append(f"Tools: {tool_summary}")

    if custom_tool_calls:
        parts.append(f"Custom tool calls: {custom_tool_calls}")

    if patch_count:
        parts.append(f"Patches: {patch_count}")

    if commands:
        parts.append(f"Commands: {'; '.join(commands[:3])}")

    return " | ".join(parts)[:500]


def build_common_entry_fields(session_data: dict, repo_context: dict) -> dict:
    student = git("git", "config", "user.email")
    if not student:
        student = os.environ.get("USERNAME", os.environ.get("USER", "unknown"))

    branch = session_data["branch"] or git("git", "rev-parse", "--abbrev-ref", "HEAD")
    commit = session_data["commit"]
    if len(commit) > 7:
        commit = commit[:7]
    if not commit:
        commit = git("git", "rev-parse", "--short", "HEAD")

    model = session_data["model_provider"] or "codex"
    return {
        "model": model,
        "repo": repo_context["repo_name"],
        "branch": branch,
        "commit": commit,
        "student": student,
    }


def create_prompt_entries(session_data: dict, repo_context: dict) -> list[dict]:
    common = build_common_entry_fields(session_data, repo_context)
    entries = []
    for index, turn in enumerate(session_data["turns"], start=1):
        prompt = turn["prompt"] or session_data["thread_name"] or "Codex turn (no user prompt extracted)"
        ts = to_vn_iso(turn["completed_at"] or turn["started_at"] or session_data["updated_at"] or session_data["started_at"])
        turn_id = turn["turn_id"] or f"turn-{index}"
        entries.append({
            "ts": ts,
            "tool": "codex",
            "event": "PromptScan",
            "session_id": session_data["session_id"],
            "turn_id": turn_id,
            "entry_id": f"codex-{session_data['session_id'][:8]}-{turn_id[:8]}-{datetime.now(VN_TZ).strftime('%Y%m%d-%H%M%S')}",
            "prompt": prompt[:1000],
            "response_summary": build_response_summary(turn, session_data),
            "scan_source": "log_codex.py",
            **common,
        })
    return entries


def create_session_entry(session_data: dict, repo_context: dict) -> dict:
    common = build_common_entry_fields(session_data, repo_context)
    ts = to_vn_iso(session_data["updated_at"] or session_data["started_at"])
    return {
        "ts": ts,
        "tool": "codex",
        "event": "SessionScan",
        "session_id": session_data["session_id"],
        "entry_id": f"codex-session-{session_data['session_id'][:8]}-{datetime.now(VN_TZ).strftime('%Y%m%d-%H%M%S')}",
        "prompt": build_session_prompt_summary(session_data),
        "response_summary": build_session_response_summary(session_data),
        "scan_source": "log_codex.py",
        **common,
    }


def create_log_entries(session_data: dict, repo_context: dict, mode: str) -> list[dict]:
    entries = []
    if mode in ("session", "both"):
        entries.append(create_session_entry(session_data, repo_context))
    if mode in ("prompt", "both"):
        entries.extend(create_prompt_entries(session_data, repo_context))
    return entries


def find_session_file(sessions_dir: Path, session_id: str) -> Path | None:
    matches = sorted(sessions_dir.rglob(f"*{session_id}.jsonl"))
    if matches:
        return matches[-1]
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract Codex session history and append session or prompt entries."
    )
    parser.add_argument(
        "--mode",
        choices=["prompt", "session", "both"],
        default="prompt",
        help="Log one entry per prompt, one entry per session, or both (default: prompt)",
    )
    parser.add_argument("--auto", action="store_true", help="Scan recent sessions for this repo")
    parser.add_argument("--hours", type=int, default=24, help="Look back this many hours")
    parser.add_argument("--session-id", help="Scan one specific Codex session id")
    parser.add_argument("--all", action="store_true", help="Scan all sessions, not just recent ones")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be logged without writing")
    parser.add_argument("--force", action="store_true", help="Allow re-scanning a session that is already logged")
    args = parser.parse_args()

    if not args.auto and not args.session_id and not args.all:
        args.auto = True

    repo_context = get_repo_context()
    if repo_context is None:
        print("[codex-log] Cannot determine repo root. Run this inside a git repo.", file=sys.stderr)
        sys.exit(0)

    sessions_dir = get_sessions_dir()
    if sessions_dir is None:
        print("[codex-log] Codex sessions directory not found.", file=sys.stderr)
        print(f"[codex-log] Expected: {get_codex_home() / 'sessions'}", file=sys.stderr)
        sys.exit(0)

    log_file = resolve_log_file(repo_context["repo_root"])
    logged_turn_keys = get_logged_turn_keys(log_file)
    logged_session_ids = get_logged_session_ids(log_file)
    session_index = load_session_index()

    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=args.hours)
    entries = []

    if args.session_id:
        session_file = find_session_file(sessions_dir, args.session_id)
        if session_file is None:
            print(f"[codex-log] Session not found: {args.session_id}", file=sys.stderr)
            sys.exit(1)

        session_data = parse_session_file(session_file, session_index)
        if session_matches_repo(session_data, repo_context):
            for entry in create_log_entries(session_data, repo_context, args.mode):
                if entry["event"] == "PromptScan":
                    turn_key = f"{entry['session_id']}:{entry['turn_id']}"
                    if not args.force and turn_key in logged_turn_keys:
                        continue
                elif entry["event"] == "SessionScan":
                    if not args.force and entry["session_id"] in logged_session_ids:
                        continue
                entries.append(entry)
    else:
        session_files = sorted(sessions_dir.rglob("*.jsonl"))
        for session_file in session_files:
            if not args.all:
                modified_at = datetime.fromtimestamp(session_file.stat().st_mtime, tz=timezone.utc)
                if modified_at < cutoff:
                    continue

            session_data = parse_session_file(session_file, session_index)
            session_id = session_data["session_id"]
            if not session_id:
                continue
            if not session_matches_repo(session_data, repo_context):
                continue

            for entry in create_log_entries(session_data, repo_context, args.mode):
                if entry["event"] == "PromptScan":
                    turn_key = f"{entry['session_id']}:{entry['turn_id']}"
                    if not args.force and turn_key in logged_turn_keys:
                        continue
                elif entry["event"] == "SessionScan":
                    if not args.force and entry["session_id"] in logged_session_ids:
                        continue
                entries.append(entry)

    if not entries:
        print(f"[codex-log] No new Codex entries found for this repo in {args.mode} mode.", file=sys.stderr)
        sys.exit(0)

    if args.dry_run:
        print(f"[codex-log] DRY RUN - would log {len(entries)} item(s) in {args.mode} mode:")
        for entry in entries:
            if entry["event"] == "PromptScan":
                print(f"  - [prompt {entry['session_id'][:8]}:{entry['turn_id'][:8]}] {entry['prompt'][:80]}")
            else:
                print(f"  - [session {entry['session_id'][:8]}] {entry['prompt'][:80]}")
        sys.exit(0)

    with open(log_file, "a", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"[codex-log] Logged {len(entries)} Codex item(s) in {args.mode} mode.")
    for entry in entries:
        if entry["event"] == "PromptScan":
            print(f"  - [prompt {entry['session_id'][:8]}:{entry['turn_id'][:8]}] {entry['prompt'][:80]}")
        else:
            print(f"  - [session {entry['session_id'][:8]}] {entry['prompt'][:80]}")
    print(f"[codex-log] Saved to: {log_file}")


if __name__ == "__main__":
    main()
