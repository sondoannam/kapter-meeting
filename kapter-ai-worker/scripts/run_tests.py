from __future__ import annotations

import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    worker_root = Path(__file__).resolve().parent.parent
    runtime_root = worker_root / ".pytest-runs"
    run_dir = runtime_root / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")

    runtime_root.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(run_dir, ignore_errors=True)

    env = os.environ.copy()
    env.setdefault("PYTHONDONTWRITEBYTECODE", "1")

    args = [
        sys.executable,
        "-m",
        "pytest",
        "tests",
        "-q",
        "--basetemp",
        str(run_dir),
        "-p",
        "no:cacheprovider",
    ]

    completed = subprocess.run(args, cwd=worker_root, env=env, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
