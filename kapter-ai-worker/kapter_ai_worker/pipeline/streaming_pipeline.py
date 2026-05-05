from __future__ import annotations

import time
import re
import threading
from collections import OrderedDict, defaultdict
import numpy as np
import torch
from kapter_ai_worker.core.base_asr import BaseASR
from kapter_ai_worker.core.base_diarizer import BaseDiarizer
from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
from kapter_ai_worker.core.entities import (
    AudioChunk,
    DiarizedTranscriptSegment,
    PipelineChunkResult,
    SpeakerSpan,
    TranscriptSpan,
)
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.logging.logger import get_logger
from kapter_ai_worker.utils.alignment import strip_overlap

_logger = get_logger("StreamingInferencePipeline")


class StreamingInferencePipeline:
    """Orchestrates ASR and Diarization for streaming audio chunks."""

    def __init__(
        self,
        asr: BaseASR,
        diarizer: BaseDiarizer,
        vad: BaseVoiceActivityDetector | None = None,
        registry: SpeakerRegistry | None = None,
    ) -> None:
        self._asr = asr
        self._diarizer = diarizer
        self._vad = vad
        self._registry = registry

        # Multi-meeting state
        self._last_emitted_by_stream: OrderedDict[str, float] = OrderedDict()
        self._last_transcript_by_stream: OrderedDict[str, str] = OrderedDict()
        self._last_activity_by_stream: dict[str, float] = {}
        self._global_last_emitted_end_time = 0.0
        self._chunk_count = 0
        self._last_cleanup_time = time.time()

        # Concurrency control
        self._stream_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
        self._global_lock = threading.Lock()

    def process_chunk(
        self,
        audio_chunk: AudioChunk,
        stream_id: str | None = None,
        registry: SpeakerRegistry | None = None,
        step_duration: float | None = None,
        authoritative_speaker_label: str | None = None,
    ) -> PipelineChunkResult:
        # 0. Locking: Ensure sequential processing per stream
        lock = self._stream_locks[stream_id] if stream_id else self._global_lock

        with lock:
            active_registry = registry or self._registry

        # ASR with Context: Use the last emitted text as an initial prompt
        # to maintain coherence across sliding window boundaries.
        initial_prompt = None
        if stream_id:
            initial_prompt = self._last_transcript_by_stream.get(stream_id)

        transcript_spans = self._asr.transcribe(
            audio_chunk, initial_prompt=initial_prompt
        )
        if not transcript_spans:
            return PipelineChunkResult(
                audio_chunk=audio_chunk,
                skipped=True,
                skip_reason="no_transcript_emitted",
            )

        if authoritative_speaker_label:
            speaker_spans = []
            aligned_segments = [
                DiarizedTranscriptSegment(
                    speaker_label=authoritative_speaker_label,
                    text=span.text,
                    start_time=span.start_time,
                    end_time=span.end_time,
                    confidence=span.confidence,
                )
                for span in transcript_spans
            ]
        else:
            # Diarization with Window: We process most of the buffer
            # while keeping a small context at the end for stability.
            # For long chunks (e.g. 40s), we increase the window accordingly.
            process_duration = (
                min(audio_chunk.duration_seconds - 2.0, 35.0)
                if audio_chunk.duration_seconds > 30.0
                else 25.0
            )

            speaker_spans = self._diarizer.diarize(
                audio_chunk, registry=active_registry, process_duration=process_duration
            )

            # Periodic speaker consolidation (merging duplicates)
            if active_registry:
                active_registry.consolidate_speakers()

            aligned_segments = self._align_segments(
                transcript_spans, speaker_spans, registry=active_registry
            )

        # Stability Filter: Ignore extremely short segments with low confidence
        # to reduce flickering noise in the final transcript.
        aligned_segments = [
            s
            for s in aligned_segments
            if (s.end_time - s.start_time) > 0.4
            or (s.confidence is not None and s.confidence > 0.8)
        ]

        # Transcript Stitching: Filter out segments that were already emitted
        last_emitted_time = (
            self._last_emitted_by_stream.get(stream_id, 0.0)
            if stream_id
            else self._global_last_emitted_end_time
        )
        last_emitted_text = (
            self._last_transcript_by_stream.get(stream_id, "") if stream_id else ""
        )

        new_segments = []
        current_step_text = []

        for segment in aligned_segments:
            # 1. Temporal Filter: If segment ends before last emitted, skip
            # We allow 0.5s overlap for fuzzy boundary matching
            if segment.end_time <= last_emitted_time - 0.5:
                continue

            # 2. Semantic Deduplication: Strip prefix that was already emitted
            # This handles cases where a segment straddles the boundary or is repeated due to overlap
            current_text = segment.text.strip()

            if last_emitted_text:
                # Fast path: If the new text isn't even partially in the history, don't run the expensive splitter
                # We check the first 3 words for a quick match
                first_few_words = " ".join(current_text.split()[:3])
                if first_few_words and first_few_words in last_emitted_text:
                    clean_text = strip_overlap(last_emitted_text, current_text)

                    # If everything was stripped, it's a full duplicate
                    if not clean_text.strip():
                        continue

                    segment.text = clean_text.strip()

            # 3. Global Repetition Filter: Strip sentences that already exist in history
            # This handles Whisper hallucinations where it repeats old sentences in the middle.
            if last_emitted_text and segment.text:
                # PERFORMANCE: Pre-normalize history ONCE per chunk
                h_norm_raw = re.sub(r"[^\w\s]", "", last_emitted_text.lower())
                h_words_set = set(h_norm_raw.split())

                sentences = re.split(r"(?<=[.!?])\s+", segment.text)
                cleaned_sentences = []

                for sentence in sentences:
                    s_words = re.sub(r"[^\w\s]", "", sentence.lower()).split()
                    if len(s_words) > 4:
                        # Fast overlap check using set intersection
                        matches = sum(1 for w in s_words if w in h_words_set)
                        overlap_ratio = matches / len(s_words)

                        # If > 80% of words exist in history, it's likely a repetition
                        if overlap_ratio > 0.8:
                            _logger.debug(
                                f"Global repetition filtered (ratio={overlap_ratio:.2f}): '{sentence[:50]}...'"
                            )
                            continue

                    cleaned_sentences.append(sentence)

                segment.text = " ".join(cleaned_sentences).strip()

            if not segment.text:
                continue

            new_segments.append(segment)
            last_emitted_time = max(last_emitted_time, segment.end_time)
            current_step_text.append(segment.text)

        if stream_id:
            # Update LRU and activity
            self._last_emitted_by_stream[stream_id] = last_emitted_time
            self._last_emitted_by_stream.move_to_end(stream_id)

            # Update meeting history buffer for the next deduplication cycle
            if current_step_text:
                new_transcript = " ".join(current_step_text)
                combined = f"{last_emitted_text} {new_transcript}".strip()
                # Keep last 120 words for context (reduced to avoid over-prompting hallucination)
                self._last_transcript_by_stream[stream_id] = " ".join(
                    combined.split()[-120:]
                )
                self._last_transcript_by_stream.move_to_end(stream_id)

            self._last_activity_by_stream[stream_id] = time.time()

            # 1. Throttled Cleanup Strategy (Hybrid):
            # We reduce cleanup frequency to save CPU, but ensure it runs if either:
            # - The stream cache is getting full (>50 streams)
            # - OR we processed 10 more chunks AND at least 10 seconds have passed.
            # This ensures responsiveness in high-frequency streaming while preventing CPU spikes.
            self._chunk_count += 1
            now = time.time()
            stream_count = len(self._last_emitted_by_stream)

            if stream_count > 50 or (
                self._chunk_count % 10 == 0 and now - self._last_cleanup_time > 10.0
            ):
                self._cleanup_expired_streams()
                self._last_cleanup_time = now

            # 2. Hard limit cleanup (LRU)
            if len(self._last_emitted_by_stream) > 64:
                old_key, _ = self._last_emitted_by_stream.popitem(last=False)
                self._last_transcript_by_stream.pop(old_key, None)
                self._last_activity_by_stream.pop(old_key, None)
                _logger.info(f"LRU Eviction: removed state for stream {old_key}")
        else:
            self._global_last_emitted_end_time = last_emitted_time

        return PipelineChunkResult(
            audio_chunk=audio_chunk,
            transcript_spans=transcript_spans,
            speaker_spans=speaker_spans,
            emitted_segments=new_segments,
        )

    def clear(self, stream_id: str | None = None):
        """Reset the pipeline state for a new session."""
        if stream_id:
            self._last_emitted_by_stream.pop(stream_id, None)
            self._last_transcript_by_stream.pop(stream_id, None)
            self._last_activity_by_stream.pop(stream_id, None)
            # Remove the lock for this stream once the session is guaranteed to be finished.
            # This prevents memory leaks from growing indefinitely.
            self._stream_locks.pop(stream_id, None)
        else:
            self._last_emitted_by_stream.clear()
            self._last_transcript_by_stream.clear()
            self._last_activity_by_stream.clear()
            self._stream_locks.clear()
            self._global_last_emitted_end_time = 0.0
            if self._registry:
                self._registry.clear()

        # Reset VAD states if present to ensure a clean slate for the next meeting
        if self._vad:
            self._vad.reset_states()

        _logger.info(f"Pipeline state cleared for stream: {stream_id or 'ALL'}")

    def _cleanup_expired_streams(self, ttl_seconds: float = 1800.0):
        """Remove streams that have been inactive for too long."""
        now = time.time()
        expired_keys = [
            sid
            for sid, last_active in self._last_activity_by_stream.items()
            if now - last_active > ttl_seconds
        ]

        for sid in expired_keys:
            self._last_emitted_by_stream.pop(sid, None)
            self._last_transcript_by_stream.pop(sid, None)
            self._last_activity_by_stream.pop(sid, None)
            _logger.info(f"TTL Cleanup: removed expired state for stream {sid}")

    def _align_segments(
        self,
        transcript_spans: list[TranscriptSpan],
        speaker_spans: list[SpeakerSpan],
        registry: SpeakerRegistry | None = None,
    ) -> list[DiarizedTranscriptSegment]:
        """Align words with speaker labels and group them into logical segments."""
        if not transcript_spans:
            return []

        # 1. Individual word-to-speaker assignment
        aligned_words: list[DiarizedTranscriptSegment] = []
        for span in transcript_spans:
            speaker_label = self._resolve_speaker_label(
                span, speaker_spans, registry=registry
            )
            aligned_words.append(
                DiarizedTranscriptSegment(
                    speaker_label=speaker_label,
                    text=span.text,
                    start_time=span.start_time,
                    end_time=span.end_time,
                    confidence=span.confidence,
                )
            )

        # 2. Group adjacent words with the same speaker into continuous segments
        grouped_segments: list[DiarizedTranscriptSegment] = []
        current = aligned_words[0]

        for word in aligned_words[1:]:
            # If same speaker and gap is reasonably small (< 1.0s), merge them
            # 1.0s is a safe default for natural conversation flow.
            gap = word.start_time - current.end_time
            if word.speaker_label == current.speaker_label and gap < 1.0:
                current.text = f"{current.text} {word.text}"
                current.end_time = word.end_time
                current.confidence = (
                    min(current.confidence, word.confidence)
                    if current.confidence is not None and word.confidence is not None
                    else current.confidence or word.confidence
                )
            else:
                grouped_segments.append(current)
                current = word

        grouped_segments.append(current)

        # 3. Final Validation: Filter out invalid segments (0 duration or negative time)
        # to prevent Pydantic validation errors in the response contract.
        valid_segments = [
            s for s in grouped_segments if s.end_time > s.start_time and s.end_time > 0
        ]

        return valid_segments

    def _resolve_speaker_label(
        self,
        transcript_span: TranscriptSpan,
        speaker_spans: list[SpeakerSpan],
        registry: SpeakerRegistry | None = None,
    ) -> str:
        # Filter out literal "UNKNOWN" strings coming from Pyannote/Registry
        valid_spans = [s for s in speaker_spans if s.speaker_label != "UNKNOWN"]

        active_registry = registry or self._registry

        if not valid_spans:
            if active_registry:
                last_speaker = active_registry.get_last_active_speaker()
                if last_speaker and last_speaker.last_active_time >= 0:
                    return active_registry.get_canonical_id(last_speaker.speaker_id)
            return "UNKNOWN"

        # Multi-label Alignment: Find all speakers who overlap OR are very close to the boundaries
        # This 'fuzzy overlap' helps fix 'bleeding' at speaker transitions.
        overlaps = []
        BOUNDARY_TOLERANCE = 0.6  # 600ms tolerance for diarization lag

        for speaker_span in valid_spans:
            # 1. Direct overlap
            duration = self._calculate_overlap(transcript_span, speaker_span)

            # 2. Fuzzy overlap (Lookahead/Lookbehind):
            # If the word is extremely close to the speaker span (within 400ms),
            # we count it as a potential overlap to allow the scoring logic to decide.
            is_very_close = False
            if duration == 0:
                gap_before = speaker_span.start_time - transcript_span.end_time
                gap_after = transcript_span.start_time - speaker_span.end_time
                if (
                    0 <= gap_before < BOUNDARY_TOLERANCE
                    or 0 <= gap_after < BOUNDARY_TOLERANCE
                ):
                    is_very_close = True

            if duration > 0 or is_very_close:
                overlaps.append((speaker_span, duration, is_very_close))

        if overlaps:
            # Priority Alignment: Find the speaker who covers the MIDPOINT of the word.
            mid_time = (transcript_span.start_time + transcript_span.end_time) / 2.0

            def alignment_score(item):
                s_span, overlap_duration, is_very_close = item

                # Bonus for containing the midpoint
                contains_mid = s_span.start_time <= mid_time <= s_span.end_time

                # Transition Priority:
                # If a speaker starts during the word or very close to it (within 200ms of start),
                # they are highly likely the NEXT speaker who should win the turn.
                # This helps wrestled words away from lingering previous speakers.
                is_just_starting = s_span.start_time >= transcript_span.start_time - 0.2

                transition_bonus = 0.0
                if is_just_starting:
                    # Stronger bonus for speakers who start near the word boundary
                    transition_bonus = 1.2
                elif is_very_close and s_span.start_time >= transcript_span.end_time:
                    # Fallback for speakers who start immediately after the word
                    transition_bonus = 0.6

                # Weight: overlap duration + 1.5s bonus for midpoint coverage + transition bonus
                score = (
                    overlap_duration + (1.5 if contains_mid else 0.0) + transition_bonus
                )
                return score

            overlaps.sort(key=alignment_score, reverse=True)
            label = overlaps[0][0].speaker_label
        else:
            # Word falls into a significant gap. Fallback: Find the nearest speaker in time.
            mid_time = (transcript_span.start_time + transcript_span.end_time) / 2.0

            def distance(span: SpeakerSpan) -> float:
                if mid_time < span.start_time:
                    return span.start_time - mid_time
                elif mid_time > span.end_time:
                    return mid_time - span.end_time
                return 0.0

            nearest_speaker = min(valid_spans, key=distance)
            label = nearest_speaker.speaker_label

        if active_registry:
            label = active_registry.get_canonical_id(label)

        return label

    @staticmethod
    def _calculate_overlap(
        transcript_span: TranscriptSpan,
        speaker_span: SpeakerSpan,
    ) -> float:
        overlap_start = max(transcript_span.start_time, speaker_span.start_time)
        overlap_end = min(transcript_span.end_time, speaker_span.end_time)
        return max(0.0, overlap_end - overlap_start)
