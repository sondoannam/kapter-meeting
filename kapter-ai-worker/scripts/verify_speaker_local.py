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
from kapter_ai_worker.runtime.pipeline_factory import build_pipeline
from kapter_ai_worker.core.entities import AudioChunk
from kapter_ai_worker.utils.audio import load_audio_file
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry

DB_PATH = "speakers.db"

def verify_speaker():
    parser = argparse.ArgumentParser(description="Verify a voice against SQLite DB")
    parser.add_argument("audio_path", type=str, help="Path to the audio file to verify")
    args = parser.parse_args()

    if not Path(DB_PATH).exists():
        print(f"Error: {DB_PATH} not found. Register a voice first.")
        return

    settings = get_settings()
    settings.use_real_models = True
    
    print(f"Analyzing {args.audio_path}...")
    pipeline = build_pipeline(settings)
    diarizer = pipeline._diarizer
    embedding_model = diarizer.get_embedding_model()

    # Load audio
    samples, sample_rate = load_audio_file(Path(args.audio_path), target_sample_rate=16000)
    duration = len(samples) / sample_rate
    
    chunk = AudioChunk(
        index=0,
        start_time=0.0,
        end_time=duration,
        sample_rate=sample_rate,
        samples=samples,
        total_chunks=1
    )

    embedding = embedding_model.get_embedding(chunk, 0.0, duration)
    if embedding is None:
        print("Error: Could not extract embedding.")
        return

    # Load from SQLite
    known_speakers = []
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT speaker_id, embedding FROM speakers")
        rows = cursor.fetchall()
        for sid, emb_json in rows:
            known_speakers.append({
                "speakerId": sid,
                "embedding": np.array(json.loads(emb_json), dtype=np.float32)
            })

    if not known_speakers:
        print("No speakers found in database.")
        return

    # Use SpeakerRegistry logic to compare
    registry = SpeakerRegistry(
        match_threshold=settings.speaker_match_threshold,
        glue_threshold=settings.speaker_glue_threshold
    )
    
    # Pre-seed registry
    for s in known_speakers:
        registry.add_known_speaker(s["speakerId"], s["embedding"])

    print("\n--- Comparison Results ---")
    results = []
    for s in known_speakers:
        # Calculate similarity (cosine similarity for normalized embeddings is just dot product)
        similarity = float(np.dot(embedding, s["embedding"]))
        match_status = "MATCH!" if similarity >= settings.speaker_match_threshold else "No match"
        print(f"Speaker: {s['speakerId']:<20} | Similarity: {similarity:.4f} | {match_status}")
        results.append((similarity, s["speakerId"]))

    decision = registry.identify_speaker(embedding, 0.0, duration, update_profile=False)
    print(f"\nFinal Registry Decision: {decision}")

    if decision in [s["speakerId"] for s in known_speakers]:
        print(f"Conclusion: Successfully matched to '{decision}'.")
    elif decision == "UNKNOWN":
        print("Conclusion: Speaker is NOT recognized (below glue/match thresholds).")
    else:
        print(f"Conclusion: Speaker is NEW (long enough but no match to existing ones).")

if __name__ == "__main__":
    verify_speaker()
