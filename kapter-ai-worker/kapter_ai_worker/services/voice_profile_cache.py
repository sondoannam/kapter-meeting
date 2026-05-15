from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from kapter_ai_worker.logging.logger import get_logger

logger = get_logger("voice_profile_cache")


@dataclass(slots=True)
class CachedVoiceProfile:
    voice_profile_id: str
    display_name: str
    is_active: bool
    embeddings: list[list[float]]


class VoiceProfileCache:
    def __init__(self, cache_path: Path) -> None:
        self._cache_path = cache_path
        self._profiles_by_id: dict[str, CachedVoiceProfile] = {}
        self._load()

    def _load(self) -> None:
        self._profiles_by_id = {}

        if not self._cache_path.exists():
            return

        try:
            payload = json.loads(self._cache_path.read_text(encoding="utf-8"))
            profiles = payload.get("profiles", [])
            if not isinstance(profiles, list):
                return

            for item in profiles:
                if not isinstance(item, dict):
                    continue

                voice_profile_id = str(item.get("voiceProfileId", "")).strip()
                display_name = str(item.get("displayName", "")).strip()
                is_active = bool(item.get("isActive", True))
                raw_embeddings = item.get("embeddings", [])

                if (
                    not voice_profile_id
                    or not display_name
                    or not isinstance(raw_embeddings, list)
                    or len(raw_embeddings) == 0
                ):
                    continue

                embeddings: list[list[float]] = []
                for raw_embedding in raw_embeddings:
                    if not isinstance(raw_embedding, list) or len(raw_embedding) == 0:
                        continue
                    embeddings.append([float(value) for value in raw_embedding])

                if not embeddings:
                    continue

                self._profiles_by_id[voice_profile_id] = CachedVoiceProfile(
                    voice_profile_id=voice_profile_id,
                    display_name=display_name,
                    is_active=is_active,
                    embeddings=embeddings,
                )
        except Exception as error:  # noqa: BLE001
            logger.warning(
                "Failed to load voice profile cache from {}: {}",
                self._cache_path,
                error,
            )

    def _persist(self) -> None:
        self._cache_path.parent.mkdir(parents=True, exist_ok=True)
        profiles = [
            {
                "voiceProfileId": profile.voice_profile_id,
                "displayName": profile.display_name,
                "isActive": profile.is_active,
                "embeddings": profile.embeddings,
            }
            for profile in sorted(
                self._profiles_by_id.values(),
                key=lambda item: item.display_name.lower(),
            )
        ]
        self._cache_path.write_text(
            json.dumps({"profiles": profiles}, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def upsert_profile(
        self,
        *,
        voice_profile_id: str,
        display_name: str,
        is_active: bool,
        embeddings: list[list[float]],
    ) -> None:
        normalized_embeddings = []
        for raw_embedding in embeddings:
            embedding_array = np.array(raw_embedding, dtype=np.float32)
            norm = np.linalg.norm(embedding_array)
            if norm > 0:
                embedding_array /= norm
            normalized_embeddings.append(
                [float(value) for value in embedding_array.tolist()]
            )

        self._profiles_by_id[voice_profile_id] = CachedVoiceProfile(
            voice_profile_id=voice_profile_id,
            display_name=display_name.strip(),
            is_active=is_active,
            embeddings=normalized_embeddings,
        )
        self._persist()

    def delete_profile(self, voice_profile_id: str) -> None:
        self._profiles_by_id.pop(voice_profile_id, None)
        self._persist()

    def clear_profiles(self) -> None:
        self._profiles_by_id.clear()
        self._persist()

    def get_profiles_by_ids(
        self,
        voice_profile_ids: list[str],
    ) -> list[CachedVoiceProfile]:
        if not voice_profile_ids:
            return [
                profile
                for profile in self._profiles_by_id.values()
                if profile.is_active
            ]

        matched_profiles: list[CachedVoiceProfile] = []
        for voice_profile_id in voice_profile_ids:
            profile = self._profiles_by_id.get(voice_profile_id)
            if profile and profile.is_active:
                matched_profiles.append(profile)
        return matched_profiles
