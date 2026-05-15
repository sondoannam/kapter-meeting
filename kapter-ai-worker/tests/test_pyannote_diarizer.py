from __future__ import annotations

import numpy as np

from kapter_ai_worker.core.entities import AudioChunk
from kapter_ai_worker.core.speaker_registry import SpeakerMatchResult
from kapter_ai_worker.models.pyannote_diarizer import PyannoteDiarizer


def test_should_merge_local_speakers_requires_both_sides_to_have_real_duration() -> None:
    assert not PyannoteDiarizer._should_merge_local_speakers(
        similarity=0.95,
        primary_total_duration=6.0,
        secondary_total_duration=1.8,
    )
    assert PyannoteDiarizer._should_merge_local_speakers(
        similarity=0.95,
        primary_total_duration=6.0,
        secondary_total_duration=3.2,
    )


def test_short_fallback_is_not_safe_for_anonymous_labels() -> None:
    assert not PyannoteDiarizer._is_safe_short_fallback_label("P2")
    assert PyannoteDiarizer._is_safe_short_fallback_label("RECORDER")
    assert PyannoteDiarizer._is_safe_short_fallback_label("Alice Nguyen")


def test_anonymous_label_detection_matches_public_meeting_speakers_only() -> None:
    assert PyannoteDiarizer._is_anonymous_label("P1")
    assert not PyannoteDiarizer._is_anonymous_label("C1")
    assert not PyannoteDiarizer._is_anonymous_label("RECORDER")


class _FakeTurn:
    def __init__(self, start: float, end: float) -> None:
        self.start = start
        self.end = end


class _FakeAnnotation:
    def __init__(self, turns: list[tuple[float, float, str]]) -> None:
        self._turns = turns

    def itertracks(self, yield_label: bool = False):
        for start, end, label in self._turns:
            turn = _FakeTurn(start, end)
            if yield_label:
                yield turn, None, label
            else:
                yield turn, None


class _FakePipeline:
    def __init__(self, turns: list[tuple[float, float, str]]) -> None:
        self._annotation = _FakeAnnotation(turns)

    def __call__(self, audio_input):
        return self._annotation


class _FakeEmbeddingModel:
    _min_duration = 1.25

    def get_embedding(self, audio_chunk, start_time_local: float, end_time_local: float):
        duration = end_time_local - start_time_local
        if duration < self._min_duration:
            return None
        return np.array([1.0, 0.0], dtype=np.float32)


class _FakeRegistry:
    def __init__(self, result: SpeakerMatchResult) -> None:
        self._result = result

    def match_speaker(self, *args, **kwargs):
        return self._result

    def get_speaker(self, speaker_id: str):
        return None

    def get_last_active_speaker(self):
        return None

    def get_canonical_id(self, speaker_id: str) -> str:
        return speaker_id


def _build_test_diarizer(result: SpeakerMatchResult) -> tuple[PyannoteDiarizer, _FakeRegistry]:
    diarizer = PyannoteDiarizer.__new__(PyannoteDiarizer)
    diarizer._embedding_model = _FakeEmbeddingModel()
    diarizer._pipeline = _FakePipeline([(0.0, 4.0, "SPEAKER_00")])
    registry = _FakeRegistry(result)
    return diarizer, registry


def test_diarize_keeps_candidate_backed_turn_unknown() -> None:
    diarizer, registry = _build_test_diarizer(
        SpeakerMatchResult(
            label="C1",
            status="new_candidate",
            best_score=0.71,
            second_best_score=-1.0,
            should_update_profile=True,
            matched_candidate_id="C1",
        ),
    )

    spans = diarizer.diarize(
        AudioChunk(
            index=1,
            start_time=0.0,
            end_time=4.0,
            sample_rate=16000,
            samples=np.zeros(64000, dtype=np.float32),
            total_chunks=1,
        ),
        registry=registry,
        process_duration=4.0,
    )

    assert [span.speaker_label for span in spans] == ["UNKNOWN"]


def test_diarize_emits_public_label_after_candidate_promotion() -> None:
    diarizer, registry = _build_test_diarizer(
        SpeakerMatchResult(
            label="P1",
            status="confirmed_match",
            best_score=0.79,
            second_best_score=0.2,
            should_update_profile=False,
            matched_speaker_id="P1",
        ),
    )

    spans = diarizer.diarize(
        AudioChunk(
            index=1,
            start_time=0.0,
            end_time=4.0,
            sample_rate=16000,
            samples=np.zeros(64000, dtype=np.float32),
            total_chunks=1,
        ),
        registry=registry,
        process_duration=4.0,
    )

    assert [span.speaker_label for span in spans] == ["P1"]
