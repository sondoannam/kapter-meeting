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

# Patterns that Whisper hallucinations on silence/noise
_HALLUCINATION_PATTERNS = [
    re.compile(r"^[\s\.\,\!\?\;\:\-\–\—\…]+$"),              # Only punctuation
    re.compile(r"(.{3,}?)\1{2,}", re.IGNORECASE),             # Repeated phrase 3+ times
    re.compile(r"^(Phụ đề|Subtitles|Đăng ký|Subscribe|Thank)", re.IGNORECASE),
    re.compile(r"^(Hẹn gặp lại|Cảm ơn đã xem|Nhớ đăng ký)", re.IGNORECASE),
    re.compile(r"^♪|🎵|🎶|♫"),                                # Music symbols
    re.compile(r"^(Tạm biệt|Bye|Goodbye|See you)[\.\!]*$", re.IGNORECASE),
    # Vietnamese YouTube channel hallucinations
    re.compile(r"Ghiền Mì Gõ", re.IGNORECASE),
    re.compile(r"subscribe.*kênh", re.IGNORECASE),
    re.compile(r"(bấm|nhấn)\s*(chuông|like|subscribe)", re.IGNORECASE),
    re.compile(r"không\s+bỏ\s+lỡ", re.IGNORECASE),
    re.compile(r"video\s+hấp\s+dẫn", re.IGNORECASE),
    re.compile(r"^Hãy\s+subscribe", re.IGNORECASE),
    re.compile(r"(Để không bỏ lỡ|Đừng quên đăng ký)", re.IGNORECASE),
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
        hallucination_logprob_threshold: float = -1.0,
        max_segment_repeat: int = 2,
        min_audio_rms: float = 0.01,
    ) -> None:
        self._beam_size = beam_size
        self._language = language
        self._hallucination_logprob_threshold = hallucination_logprob_threshold
        self._max_segment_repeat = max_segment_repeat
        self._min_audio_rms = min_audio_rms
        self._recent_texts = deque(maxlen=20)

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
        rms = float(np.sqrt(np.mean(samples ** 2)))
        if rms < self._min_audio_rms:
            return True
        return False

    def _is_hallucination(self, text: str, avg_logprob: float) -> bool:
        stripped = text.strip()
        if not stripped:
            return True
        if avg_logprob < self._hallucination_logprob_threshold:
            _logger.debug(f"Filtered by logprob ({avg_logprob:.2f} < {self._hallucination_logprob_threshold}): '{stripped[:60]}'")
            return True
        for pattern in _HALLUCINATION_PATTERNS:
            if pattern.search(stripped):
                _logger.debug(f"Filtered by hallucination pattern: '{stripped[:60]}'")
                return True
        if len(stripped) > 15 and stripped in list(self._recent_texts)[-self._max_segment_repeat:]:
            _logger.debug(f"Filtered by repetition: '{stripped[:60]}'")
            return True
        return False

    def transcribe(self, audio_chunk: AudioChunk, initial_prompt: str | None = None) -> list[TranscriptSpan]:
        """Transcribe an audio chunk and return spans with absolute timestamps."""
        
        if self._is_audio_silent(audio_chunk.samples):
            return []

        # CLEAN & OPTIMIZED PROMPT
        standard_prompt = (
            "Cuộc họp chuyên nghiệp tiếng Việt. "
            "AI, API, Cloud, Machine Learning, LLM, bất động sản."
        )
        combined_prompt = f"{standard_prompt} {initial_prompt}" if initial_prompt else standard_prompt

        language = self._language
        if language == "auto":
            language = None

        segments, info = self._model.transcribe(
            audio_chunk.samples,
            beam_size=self._beam_size,
            language=language,
            initial_prompt=combined_prompt,
            vad_filter=False,
            word_timestamps=True,
            condition_on_previous_text=False,
            no_speech_threshold=0.9,
            log_prob_threshold=-2.5,
            repetition_penalty=1.0,
            no_repeat_ngram_size=0,
        )

        spans: list[TranscriptSpan] = []
        for segment_index, segment in enumerate(segments):
            segment_text = segment.text.strip()
            if self._is_hallucination(segment_text, segment.avg_logprob):
                continue

            if segment.words:
                for w in segment.words:
                    word_text = w.word.strip()
                    if not word_text or w.end <= w.start:
                        continue
                    spans.append(
                        TranscriptSpan(
                            text=word_text,
                            start_time=audio_chunk.start_time + w.start,
                            end_time=audio_chunk.start_time + w.end,
                            confidence=w.probability,
                            source_segment_index=segment_index,
                        )
                    )
            else:
                if not segment_text or segment.end <= segment.start:
                    continue
                spans.append(
                    TranscriptSpan(
                        text=segment_text,
                        start_time=audio_chunk.start_time + segment.start,
                        end_time=audio_chunk.start_time + segment.end,
                        confidence=segment.avg_logprob,
                        source_segment_index=segment_index,
                    )
                )

            self._recent_texts.append(segment_text)

        return spans
