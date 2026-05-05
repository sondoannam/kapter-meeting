from __future__ import annotations

import re
from collections import deque
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from kapter_ai_worker.core.base_asr import BaseASR
from kapter_ai_worker.core.entities import AudioChunk, TranscriptSpan
from kapter_ai_worker.logging.logger import get_logger

_logger = get_logger("FasterWhisperASR")

# Patterns that Whisper hallucinates on silence/noise
_HALLUCINATION_PATTERNS = [
    re.compile(r"^[\s\.\,\!\?\;\:\-\–\—\…]+$"),              # Only punctuation
    re.compile(r"(.{3,}?)\1{2,}", re.IGNORECASE),             # Repeated phrase 3+ times
    re.compile(r"^(Phụ đề|Subtitles|Đăng ký|Subscribe|Thank)", re.IGNORECASE),
    re.compile(r"^(Hẹn gặp lại|Cảm ơn đã xem|Nhớ đăng ký)", re.IGNORECASE),
    re.compile(r"^♪|🎵|🎶|♫"),                                # Music symbols
    re.compile(r"^(Tạm biệt|Bye|Goodbye|See you)[\.\!]*$", re.IGNORECASE),
]


class FasterWhisperASR(BaseASR):
    """Speech-to-text adapter using the faster-whisper library."""

    def __init__(
        self,
        model_name: str = "large-v3-turbo",
        model_dir: str | Path | None = None,
        device: str = "cuda",
        compute_type: str = "float16",
        beam_size: int = 5,
        language: str | None = "vi",
        hallucination_logprob_threshold: float = -1.5,
        max_segment_repeat: int = 2,
        min_audio_rms: float = 0.005,
    ) -> None:
        self._beam_size = beam_size
        self._language = language
        self._hallucination_logprob_threshold = hallucination_logprob_threshold
        self._max_segment_repeat = max_segment_repeat
        self._min_audio_rms = min_audio_rms
        self._recent_texts = deque(maxlen=20)  # Track recent outputs for repetition detection

        download_root = str(Path(model_dir)) if model_dir is not None else None
        _logger.info(
            f"Loading Whisper model '{model_name}' "
            f"(device={device}, compute={compute_type})..."
        )
        self._model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=download_root,
        )
        _logger.info("Whisper model loaded successfully.")

    def _is_audio_silent(self, samples: np.ndarray) -> bool:
        """Check if the audio chunk is effectively silence or noise."""
        rms = float(np.sqrt(np.mean(samples ** 2)))
        if rms < self._min_audio_rms:
            _logger.debug(f"Audio RMS {rms:.6f} below threshold {self._min_audio_rms}, skipping")
            return True
        return False

    def _is_hallucination(self, text: str, avg_logprob: float) -> bool:
        """Detect common Whisper hallucination patterns."""
        stripped = text.strip()
        if not stripped:
            return True

        # Check logprob confidence
        if avg_logprob < self._hallucination_logprob_threshold:
            _logger.debug(
                f"Low confidence hallucination filtered: '{stripped[:50]}' "
                f"(logprob={avg_logprob:.3f})"
            )
            return True

        # Check known hallucination patterns
        for pattern in _HALLUCINATION_PATTERNS:
            if pattern.search(stripped):
                _logger.debug(f"Pattern hallucination filtered: '{stripped[:50]}'")
                return True

        # Check cross-segment repetition ONLY for longer phrases.
        # Short phrases like "Vâng", "Ok" are valid normal repetitions.
        if len(stripped) > 15 and stripped in list(self._recent_texts)[-self._max_segment_repeat:]:
            _logger.debug(f"Repetition hallucination filtered: '{stripped[:50]}'")
            return True

        return False

    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None) -> list[TranscriptSpan]:
        """Transcribe an audio chunk and return spans with absolute timestamps."""
        
        # Pre-check: skip silent/noise audio entirely
        if self._is_audio_silent(audio_chunk.samples):
            return []

        # Handle auto-detection
        language = self._language
        if language == "auto":
            language = None

        segments, info = self._model.transcribe(
            audio_chunk.samples,
            beam_size=self._beam_size,
            language=language,
            initial_prompt=initial_prompt,
            # Pipeline VAD (Silero) already handled chunking — disable Whisper's
            # internal VAD to avoid double-filtering and timestamp misalignment
            vad_filter=False,
            word_timestamps=True,
            # Anti-hallucination parameters
            condition_on_previous_text=False,
            no_speech_threshold=0.8,
            log_prob_threshold=-1.5,
            repetition_penalty=1.0,
            no_repeat_ngram_size=0,
        )

        if self._language is None:
            _logger.info(
                f"Chunk {audio_chunk.index} detection: {info.language} "
                f"({info.language_probability:.4f})"
            )

        spans: list[TranscriptSpan] = []
        for segment in segments:
            # Segment-level hallucination check
            segment_text = segment.text.strip()
            if self._is_hallucination(segment_text, segment.avg_logprob):
                continue

            if segment.words:
                for w in segment.words:
                    word_text = w.word.strip()
                    if not word_text:
                        continue
                    if w.end <= w.start:
                        _logger.debug(
                            f"Skipping degenerate word span '{word_text}' "
                            f"(start={w.start}, end={w.end})"
                        )
                        continue
                    spans.append(
                        TranscriptSpan(
                            text=word_text,
                            start_time=audio_chunk.start_time + w.start,
                            end_time=audio_chunk.start_time + w.end,
                            confidence=w.probability,
                        )
                    )
            else:
                if not segment_text:
                    continue
                if segment.end <= segment.start:
                    _logger.debug(
                        f"Skipping degenerate segment span '{segment_text}' "
                        f"(start={segment.start}, end={segment.end})"
                    )
                    continue
                spans.append(
                    TranscriptSpan(
                        text=segment_text,
                        start_time=audio_chunk.start_time + segment.start,
                        end_time=audio_chunk.start_time + segment.end,
                        confidence=segment.avg_logprob,
                    )
                )

            # Track for cross-chunk repetition detection
            self._recent_texts.append(segment_text)

        return spans