from __future__ import annotations

from kapter_ai_worker.core.entities import DiarizedTranscriptSegment
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


import re

_PUNCTUATION_ONLY_RE = re.compile(r"^[.,!?;:]+$")
_SENTENCE_END_RE = re.compile(r"[.!?]+$")


def _normalize_word(word: str) -> str:
    """Lowercase and strip punctuation for robust comparison."""
    return re.sub(r"[^\w\s]", "", word.lower()).strip()


def _is_punctuation_only(text: str) -> bool:
    return bool(_PUNCTUATION_ONLY_RE.fullmatch(text.strip()))


def _ends_sentence(text: str) -> bool:
    return bool(_SENTENCE_END_RE.search(text.rstrip()))


def _join_text(base_text: str, new_text: str) -> str:
    if not base_text:
        return new_text
    if not new_text:
        return base_text
    if _is_punctuation_only(new_text):
        return f"{base_text}{new_text}"
    return f"{base_text} {new_text}"


def strip_overlap(base_text: str, new_text: str, max_words: int = 50) -> str:
    """
    Find and strip the overlapping prefix from new_text that was already in base_text.
    Uses a fuzzy matching approach to handle minor ASR variations and timestamp jitter.
    """
    words_base = base_text.strip().split()
    words_new = new_text.strip().split()

    if not words_base or not words_new:
        return new_text

    # Create normalized versions for comparison
    norm_base = [_normalize_word(w) for w in words_base]
    norm_new = [_normalize_word(w) for w in words_new]

    # 1. Exact Match Search (Fast Path)
    # Check for the longest common suffix/prefix from max_words down to 3 words.
    check_len = min(len(norm_base), len(norm_new), max_words)
    for n in range(check_len, 2, -1):
        if norm_base[-n:] == norm_new[:n]:
            return " ".join(words_new[n:])

    # 2. Fuzzy Anchor Search (Deep Path)
    # Search for an anchor only in the very end of the history (the actual overlap zone).
    # For a 10-20s overlap, searching the last 40 words is enough.
    history_limit = min(len(norm_base), 40)
    history_slice = norm_base[-history_limit:]

    anchor_size = min(len(norm_new), 5)
    if anchor_size < 3:
        return new_text

    anchor = norm_new[:anchor_size]

    # We only care about matches that are near the END of history
    best_match_idx = -1
    for i in range(len(history_slice) - anchor_size, -1, -1):
        # Optimization: if we're too far from the end, it's not a boundary overlap
        if len(history_slice) - i > max_words:
            break

        match_count = sum(
            1 for j in range(anchor_size) if history_slice[i + j] == anchor[j]
        )
        if match_count >= (anchor_size - 1) and match_count >= 3:
            best_match_idx = i
            break

    if best_match_idx != -1:
        words_to_strip = len(history_slice) - best_match_idx
        # Safety: ONLY strip if the match is reasonably close to the end of history
        # (meaning it's a legitimate sliding window overlap)
        if words_to_strip <= max_words:
            actual_strip_count = min(words_to_strip, len(words_new) - 1)
            if actual_strip_count > 0:
                return " ".join(words_new[actual_strip_count:])

    return new_text


def consolidate_segments(
    segments: list[DiarizedTranscriptSegment],
    registry: SpeakerRegistry | None = None,
    max_gap_seconds: float = 2.0,
) -> list[DiarizedTranscriptSegment]:
    """
    Merge consecutive transcript segments belonging to the same speaker.
    If a registry is provided, speaker IDs are first re-mapped to their final canonical IDs.
    """
    if not segments:
        return []

    # 1. Resolve canonical speaker labels
    resolved_segments = []
    for seg in segments:
        label = seg.speaker_label
        if registry:
            label = registry.get_canonical_id(label)

        resolved_segments.append(
            DiarizedTranscriptSegment(
                speaker_label=label,
                text=seg.text,
                start_time=seg.start_time,
                end_time=seg.end_time,
                confidence=seg.confidence,
                voice_profile_id=seg.voice_profile_id,
                source_segment_index=seg.source_segment_index,
                source_group_index=seg.source_group_index,
            )
        )

    # 2. Speaker Smoothing
    if len(resolved_segments) >= 2:
        for i in range(len(resolved_segments)):
            curr = resolved_segments[i]
            duration = curr.end_time - curr.start_time
            if duration < 0.8:
                prev_seg = resolved_segments[i - 1] if i > 0 else None
                next_seg = (
                    resolved_segments[i + 1] if i < len(resolved_segments) - 1 else None
                )

                if (
                    prev_seg
                    and next_seg
                    and prev_seg.speaker_label == next_seg.speaker_label
                ):
                    curr.speaker_label = prev_seg.speaker_label

    # 3. Merge consecutive segments and handle text deduplication
    merged: list[DiarizedTranscriptSegment] = []
    if not resolved_segments:
        return []

    current = resolved_segments[0]

    for i in range(1, len(resolved_segments)):
        next_seg = resolved_segments[i]

        is_same_speaker = next_seg.speaker_label == current.speaker_label
        gap = next_seg.start_time - current.end_time
        respects_asr_boundary = (
            current.source_group_index is None
            or next_seg.source_group_index is None
            or current.source_group_index == next_seg.source_group_index
        )

        if is_same_speaker and gap <= max_gap_seconds and respects_asr_boundary:
            base_text = current.text.strip()
            new_text = next_seg.text.strip()

            # Use utility for deduplication
            new_text_cleaned = strip_overlap(base_text, new_text)

            if not new_text_cleaned.strip():
                # Entire segment was a duplicate
                current.end_time = max(current.end_time, next_seg.end_time)
                continue

            if _ends_sentence(base_text) and not _is_punctuation_only(new_text_cleaned):
                merged.append(current)
                current = next_seg
                continue

            current.text = _join_text(base_text, new_text_cleaned)
            current.end_time = next_seg.end_time
            if current.confidence is not None and next_seg.confidence is not None:
                current.confidence = (current.confidence + next_seg.confidence) / 2
        else:
            merged.append(current)
            current = next_seg

    merged.append(current)
    return merged
