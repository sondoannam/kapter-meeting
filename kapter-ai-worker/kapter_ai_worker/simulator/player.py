from __future__ import annotations

import threading
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf
from loguru import logger


class AudioPlayer:
    """Non-blocking audio player that tracks playback position."""

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self._data, self._fs = sf.read(str(file_path))
        self._playback_start_time: float | None = None
        self._is_playing = False
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._current_frame = 0

    @property
    def duration(self) -> float:
        return len(self._data) / self._fs

    def _callback(self, outdata: np.ndarray, frames: int, time_info: dict, status: sd.CallbackFlags) -> None:
        if status:
            logger.warning(f"Audio status: {status}")
        
        chunksize = min(len(self._data) - self._current_frame, frames)
        outdata[:chunksize] = self._data[self._current_frame : self._current_frame + chunksize].reshape(-1, self._data.shape[1] if len(self._data.shape) > 1 else 1)
        
        if chunksize < frames:
            outdata[chunksize:] = 0
            self._is_playing = False
            raise sd.CallbackStop()
        
        self._current_frame += chunksize

    def start(self) -> None:
        """Start audio playback in a background thread."""
        if self._is_playing:
            return

        self._is_playing = True
        self._current_frame = 0
        self._playback_start_time = time.time()
        
        # Use simple blocking stream in a thread for easier timestamp tracking
        # or use callback for efficiency. Let's use sd.play for simplicity if we don't need low latency.
        sd.play(self._data, self._fs)

    def stop(self) -> None:
        """Stop audio playback."""
        sd.stop()
        self._is_playing = False

    def get_current_time(self) -> float:
        """Retrieve current playback position in seconds."""
        if not self._is_playing or self._playback_start_time is None:
            return 0.0
        
        # Approximate based on wall clock since sd.play started
        elapsed = time.time() - self._playback_start_time
        return min(elapsed, self.duration)

    def wait_until_finished(self) -> None:
        """Block until audio finishes playing."""
        sd.wait()
