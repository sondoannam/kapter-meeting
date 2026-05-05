from __future__ import annotations


def format_timestamp(total_seconds: float) -> str:
    """Format seconds as MM:SS.mmm for local runner output."""

    total_milliseconds = max(int(round(total_seconds * 1000)), 0)
    minutes, milliseconds_remainder = divmod(total_milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds_remainder, 1000)
    return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"