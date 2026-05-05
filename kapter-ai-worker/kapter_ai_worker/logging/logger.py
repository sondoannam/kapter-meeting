from __future__ import annotations

import sys

from loguru import logger

_LOGGER_CONFIGURED = False


def configure_logging(level: str = "INFO") -> None:
    """Configure colored console logging once for local execution."""

    global _LOGGER_CONFIGURED
    if _LOGGER_CONFIGURED:
        return

    logger.remove()
    logger.add(
        sys.stderr,
        level=level.upper(),
        colorize=True,
        format=(
            "<green>{time:HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[component]}</cyan> | "
            "<level>{message}</level>"
        ),
    )
    _LOGGER_CONFIGURED = True


def get_logger(component: str):
    """Return a logger bound to a stable component name."""

    return logger.bind(component=component)