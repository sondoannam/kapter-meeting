import argparse
import sys
import os
import sqlite3
import json
from pathlib import Path
import numpy as np

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from kapter_ai_worker.config.settings import get_settings
from kapter_ai_worker.models.speaker_embedding import SpeakerEmbedding
from kapter_ai_worker.models.silero_vad import SileroVAD
from kapter_ai_worker.core.entities import AudioChunk
from kapter_ai_worker.utils.audio import load_audio_file

DB_PATH = "speakers.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS speakers (
                speaker_id TEXT PRIMARY KEY,
                embedding TEXT NOT NULL,
                metadata TEXT
            )
        """)
        conn.commit()

def check_audio_health(samples, sample_rate):
    """Check if the audio is good enough for registration."""
    # 1. Volume Check (RMS)
    rms = np.sqrt(np.mean(samples**2))
    rms_db = 20 * np.log10(rms) if rms > 0 else -100
    
    # 2. Speech Density Check using Silero VAD
    vad = SileroVAD()
    # Mock some basic params for VAD
    speech_frames = vad.get_speech_segments(samples, sample_rate)
    
    total_speech_duration = sum(seg[1] - seg[0] for seg in speech_frames) / sample_rate
    total_duration = len(samples) / sample_rate
    speech_ratio = (total_speech_duration / total_duration) if total_duration > 0 else 0
    
    print("\n--- Audio Health Check ---")
    print(f"Volume Level: {rms_db:.2f} dB " + ("(OK)" if rms_db > -40 else "(Too Quiet!)"))
    print(f"Speech Density: {speech_ratio*100:.1f}% " + ("(OK)" if speech_ratio > 0.4 else "(Too much silence/noise!)"))
    print(f"Total Speech Found: {total_speech_duration:.2f}s")
    
    is_healthy = rms_db > -45 and speech_ratio > 0.3 and total_speech_duration > 1.5
    return is_healthy, total_speech_duration

def register_voice():
    parser = argparse.ArgumentParser(description="Register a voice profile to SQLite DB with Health Check")
    parser.add_argument("audio_path", type=str, help="Path to the audio file for registration")
    parser.add_argument("--name", type=str, required=True, help="Name of the speaker")
    parser.add_argument("--metadata", type=str, default="{}", help="Metadata for the employee card (JSON string)")
    parser.add_argument("--force", action="store_true", help="Skip health check and register anyway")
    args = parser.parse_args()

    init_db()
    settings = get_settings()

    # Load audio first to check health
    print(f"Loading {args.audio_path}...")
    samples, sample_rate = load_audio_file(Path(args.audio_path), target_sample_rate=16000)
    
    healthy, speech_dur = check_audio_health(samples, sample_rate)
    
    if not healthy and not args.force:
        print("\n[!] WARNING: Audio quality is poor. Registration might be inaccurate.")
        print("Suggestions: Speak louder, reduce background noise, or speak for at least 2-3 seconds.")
        print("Use --force if you want to register anyway.")
        return

    # LOAD ONLY THE EMBEDDING MODEL
    print(f"\nLoading Speaker Embedding model for '{args.name}'...")
    embedding_model = SpeakerEmbedding(
        model_name="pyannote/embedding",
        device=settings.device
    )

    duration = len(samples) / sample_rate
    chunk = AudioChunk(
        index=0,
        start_time=0.0,
        end_time=duration,
        sample_rate=sample_rate,
        samples=samples,
        total_chunks=1
    )

    print(f"Extracting fingerprint...")
    embedding = embedding_model.get_embedding(chunk, 0.0, duration)

    if embedding is None:
        print("Error: Could not extract embedding.")
        return

    # Save to SQLite
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        emb_json = json.dumps(embedding.tolist())
        cursor.execute(
            "INSERT OR REPLACE INTO speakers (speaker_id, embedding, metadata) VALUES (?, ?, ?)",
            (args.name, emb_json, args.metadata)
        )
        conn.commit()

    print(f"\nSuccessfully registered '{args.name}'!")
    print(f"Database: {DB_PATH}")

if __name__ == "__main__":
    register_voice()
