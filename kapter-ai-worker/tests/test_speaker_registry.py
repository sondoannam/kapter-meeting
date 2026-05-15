from __future__ import annotations

import numpy as np

from kapter_ai_worker.core.speaker_registry import SpeakerRegistry


def test_first_clean_sighting_creates_candidate_instead_of_public_speaker() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )

    result = registry.match_speaker(
        np.array([1000.0, 0.0], dtype=np.float32),
        duration=4.0,
        start_time=0.0,
        end_time=4.0,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )

    assert result.status == "new_candidate"
    assert result.label == "C1"
    assert registry.identify_speaker(
        np.array([1000.0, 0.0], dtype=np.float32),
        duration=4.0,
        start_time=0.0,
        end_time=4.0,
    ) == "UNKNOWN"


def test_second_clean_sighting_updates_same_candidate_then_promotes_to_public_speaker() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )

    first_result = registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=3.5,
        start_time=0.0,
        end_time=3.5,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    second_result = registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=3.0,
        start_time=5.0,
        end_time=8.0,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )

    assert first_result.status == "new_candidate"
    assert second_result.status == "confirmed_match"
    assert second_result.label == "P1"


def test_short_or_mixed_turns_do_not_create_candidates() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )

    short_result = registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=0.9,
        start_time=0.0,
        end_time=0.9,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    mixed_result = registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=3.0,
        start_time=2.0,
        end_time=5.0,
        is_clean_turn=False,
        allow_profile_update=False,
        allow_candidate_creation=False,
    )

    assert short_result.status == "unknown"
    assert mixed_result.status == "unknown"


def test_overlapping_window_second_sighting_promotes_same_speaker() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )

    embedding = np.array([1.0, 0.0], dtype=np.float32)

    first_result = registry.match_speaker(
        embedding,
        duration=6.0,
        start_time=40.0,
        end_time=46.0,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    second_result = registry.match_speaker(
        embedding,
        duration=6.0,
        start_time=44.0,
        end_time=50.0,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )

    assert first_result.status == "new_candidate"
    assert second_result.status == "confirmed_match"
    assert second_result.label == "P1"


def test_ambiguous_best_vs_runner_up_returns_unknown() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )

    registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=3.2,
        start_time=0.0,
        end_time=3.2,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=3.2,
        start_time=4.0,
        end_time=7.2,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    registry.match_speaker(
        np.array([0.0, 1.0], dtype=np.float32),
        duration=3.2,
        start_time=8.0,
        end_time=11.2,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )
    registry.match_speaker(
        np.array([0.0, 1.0], dtype=np.float32),
        duration=3.2,
        start_time=12.0,
        end_time=15.2,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )

    ambiguous_embedding = np.array([0.72, 0.70], dtype=np.float32)
    result = registry.match_speaker(
        ambiguous_embedding,
        duration=3.0,
        start_time=16.0,
        end_time=19.0,
        is_clean_turn=True,
        allow_profile_update=True,
        allow_candidate_creation=True,
    )

    assert result.status == "unknown"


def test_known_speaker_can_match_without_creating_candidates() -> None:
    registry = SpeakerRegistry(
        match_threshold=0.5,
        glue_threshold=0.43,
        merge_threshold=0.7,
    )
    registry.add_known_speaker(
        "Alice Nguyen",
        [np.array([1.0, 0.0], dtype=np.float32)],
        voice_profile_id="voice_1",
    )

    result = registry.match_speaker(
        np.array([1.0, 0.0], dtype=np.float32),
        duration=2.5,
        start_time=0.0,
        end_time=2.5,
        is_clean_turn=True,
        allow_profile_update=False,
        allow_candidate_creation=False,
    )

    assert result.status == "confirmed_match"
    assert result.label == "Alice Nguyen"
