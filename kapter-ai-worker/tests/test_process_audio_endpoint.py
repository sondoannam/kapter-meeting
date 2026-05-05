from __future__ import annotations

import base64
import io
import os
import wave

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


def create_client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(app)


def test_process_audio_endpoint_returns_worker_contract_shape(monkeypatch) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")

    with create_client() as client:
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


def test_process_audio_endpoint_accepts_raw_pcm_batches(monkeypatch) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "")

    with create_client() as client:
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
) -> None:
    monkeypatch.setenv("KAPTER_AI_SHARED_SECRET", "test-shared-secret")

    with create_client() as client:
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
