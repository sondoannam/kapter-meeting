from __future__ import annotations

from kapter_ai_worker.core.entities import DiarizedTranscriptSegment
from kapter_ai_worker.utils.alignment import consolidate_segments


def test_consolidate_segments_groups_words_into_sentences() -> None:
    segments = [
        DiarizedTranscriptSegment("PERSON_0", "Hello", 0.0, 0.2, 0.9),
        DiarizedTranscriptSegment("PERSON_0", "world", 0.2, 0.4, 0.9),
        DiarizedTranscriptSegment("PERSON_0", ".", 0.4, 0.45, 0.95),
        DiarizedTranscriptSegment("PERSON_0", "How", 0.55, 0.7, 0.88),
        DiarizedTranscriptSegment("PERSON_0", "are", 0.7, 0.82, 0.88),
        DiarizedTranscriptSegment("PERSON_0", "you", 0.82, 1.0, 0.88),
        DiarizedTranscriptSegment("PERSON_0", "?", 1.0, 1.05, 0.93),
    ]

    merged = consolidate_segments(segments)

    assert [segment.text for segment in merged] == ["Hello world.", "How are you?"]
    assert all(segment.speaker_label == "PERSON_0" for segment in merged)


def test_consolidate_segments_breaks_on_speaker_change() -> None:
    segments = [
        DiarizedTranscriptSegment("PERSON_0", "Thanks", 0.0, 0.2, 0.9),
        DiarizedTranscriptSegment("PERSON_0", "team", 0.2, 0.45, 0.9),
        DiarizedTranscriptSegment("PERSON_1", "I", 0.45, 0.55, 0.85),
        DiarizedTranscriptSegment("PERSON_1", "agree", 0.55, 0.8, 0.85),
    ]

    merged = consolidate_segments(segments)

    assert [segment.text for segment in merged] == ["Thanks team", "I agree"]
    assert [segment.speaker_label for segment in merged] == [
        "PERSON_0",
        "PERSON_1",
    ]


def test_consolidate_segments_breaks_on_long_pause() -> None:
    segments = [
        DiarizedTranscriptSegment("PERSON_0", "One", 0.0, 0.2, 0.9),
        DiarizedTranscriptSegment("PERSON_0", "more", 0.2, 0.45, 0.9),
        DiarizedTranscriptSegment("PERSON_0", "thing", 2.0, 2.4, 0.9),
    ]

    merged = consolidate_segments(segments, max_gap_seconds=1.0)

    assert [segment.text for segment in merged] == ["One more", "thing"]
