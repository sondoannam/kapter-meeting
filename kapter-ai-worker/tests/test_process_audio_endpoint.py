from __future__ import annotations

import base64
import io
import os
import wave
from pathlib import Path

os.environ["KAPTER_AI_USE_REAL_MODELS"] = "false"
os.environ["KAPTER_AI_DEVICE"] = "cpu"

from fastapi.testclient import TestClient

from kapter_ai_worker.config.settings import get_settings
from server import app


def build_wav_bytes() -> bytes:
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(b"\x00\x00" * 16000)

    return buffer.getvalue()


def build_pcm_s16le_bytes(sample_rate: int = 16000, seconds: int = 1) -> bytes:
    frame_count = sample_rate * seconds

    return b"\x00\x00" * frame_count


def create_client(cache_path: Path | None = None) -> TestClient:
    if cache_path is not None:
        os.environ["KAPTER_AI_VOICE_PROFILE_CACHE_PATH"] = str(cache_path)
    get_settings.cache_clear()
    return TestClient(app)


def test_process_audio_endpoint_returns_worker_contract_shape(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")

    with create_client(tmp_path / "voice_profile_cache.json") as client:
        response = client.post(
            "/api/v1/process-audio",
            json={
                "streamId": "stream_1",
                "backendMeetingId": "meeting_backend_1",
                "sequenceStart": 1,
                "sequenceEnd": 5,
                "streamOffsetMs": 0,
                "durationMs": 1000,
                "mimeType": "audio/wav",
                "audioBase64": base64.b64encode(build_wav_bytes()).decode("ascii"),
            },
        )

    assert response.status_code == 200

    payload = response.json()

    assert payload["streamId"] == "stream_1"
    assert payload["backendMeetingId"] == "meeting_backend_1"
    assert payload["sequenceStart"] == 1
    assert payload["sequenceEnd"] == 5
    assert payload["streamOffsetMs"] == 0
    assert isinstance(payload["segments"], list)
    assert isinstance(payload["speakerEvidence"], list)


def test_process_audio_endpoint_accepts_raw_pcm_batches(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")

    with create_client(tmp_path / "voice_profile_cache.json") as client:
        response = client.post(
            "/api/v1/process-audio",
            json={
                "streamId": "stream_pcm_1",
                "backendMeetingId": "meeting_backend_1",
                "sequenceStart": 6,
                "sequenceEnd": 10,
                "streamOffsetMs": 1000,
                "durationMs": 1000,
                "mimeType": "audio/pcm;rate=16000;channels=1;encoding=s16le",
                "audioBase64": base64.b64encode(build_pcm_s16le_bytes()).decode(
                    "ascii"
                ),
            },
        )

    assert response.status_code == 200

    payload = response.json()

    assert payload["streamId"] == "stream_pcm_1"
    assert payload["backendMeetingId"] == "meeting_backend_1"
    assert payload["sequenceStart"] == 6
    assert payload["sequenceEnd"] == 10
    assert payload["streamOffsetMs"] == 1000
    assert isinstance(payload["segments"], list)


def test_process_audio_endpoint_requires_bearer_token_when_configured(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "test-shared-secret")

    with create_client(tmp_path / "voice_profile_cache.json") as client:
        unauthorized = client.post(
            "/api/v1/process-audio",
            json={
                "streamId": "stream_auth_1",
                "backendMeetingId": "meeting_backend_1",
                "sequenceStart": 1,
                "sequenceEnd": 1,
                "streamOffsetMs": 0,
                "durationMs": 1000,
                "mimeType": "audio/wav",
                "audioBase64": base64.b64encode(build_wav_bytes()).decode("ascii"),
            },
        )

        authorized = client.post(
            "/api/v1/process-audio",
            headers={"Authorization": "Bearer test-shared-secret"},
            json={
                "streamId": "stream_auth_2",
                "backendMeetingId": "meeting_backend_1",
                "sequenceStart": 2,
                "sequenceEnd": 2,
                "streamOffsetMs": 1000,
                "durationMs": 1000,
                "mimeType": "audio/wav",
                "audioBase64": base64.b64encode(build_wav_bytes()).decode("ascii"),
            },
        )

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200


def test_voice_profile_cache_admin_endpoints_persist_profiles(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")
    cache_path = tmp_path / "voice_profile_cache.json"

    with create_client(cache_path) as client:
        upsert_response = client.put(
            "/api/v1/voice-profiles/cache/vp_1",
            json={
                "voiceProfileId": "vp_1",
                "displayName": "Alice Nguyen",
                "isActive": True,
                "embeddings": [[1, 0, 0]],
            },
        )
        delete_response = client.delete("/api/v1/voice-profiles/cache/vp_1")

    assert upsert_response.status_code == 200
    assert delete_response.status_code == 200
    assert cache_path.exists()
    assert '"profiles": []' in cache_path.read_text(encoding="utf-8")


def test_voice_profile_enrollment_endpoint_rejects_silent_audio(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")

    with create_client(tmp_path / "voice_profile_cache.json") as client:
        response = client.post(
            "/api/v1/voice-profiles/enrollment-extract",
            json={
                "mimeType": "audio/wav",
                "audioBase64": base64.b64encode(build_wav_bytes()).decode("ascii"),
            },
        )

    assert response.status_code == 400
