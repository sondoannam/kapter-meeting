from __future__ import annotations

import argparse
import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

from kapter_ai_worker.config.settings import WorkerSettings, get_settings
from kapter_ai_worker.core.base_vad import BaseVoiceActivityDetector
from kapter_ai_worker.logging.logger import configure_logging, get_logger
from kapter_ai_worker.core.speaker_registry import SpeakerRegistry
from kapter_ai_worker.runtime.pipeline_factory import (
    build_pipeline,
    configure_cuda_dlls,
)
from kapter_ai_worker.utils.audio import generate_vad_audio_chunks
from kapter_ai_worker.utils.time import format_timestamp
from kapter_ai_worker.utils.alignment import consolidate_segments

import warnings

warnings.filterwarnings("ignore")
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
# Suppress heavy logs from third-party libs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

logger = get_logger("local_runner")


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simulate real-time audio chunk processing for the Kapter AI worker.",
    )
    parser.add_argument("audio_path", type=Path, help="Path to a local WAV file.")
    parser.add_argument(
        "--chunk-duration",
        type=float,
        default=None,
        help="Override the chunk duration in seconds.",
    )
    parser.add_argument(
        "--stream-delay-ratio",
        type=float,
        default=None,
        help="Sleep ratio per chunk. Use 1.0 to mimic wall-clock streaming.",
    )
    parser.add_argument(
        "--expected-sample-rate",
        type=int,
        default=None,
        help="If set, reject WAV files with a different sample rate.",
    )
    parser.add_argument(
        "--real",
        action="store_true",
        default=True,
        help="Use real AI models (FasterWhisper, Pyannote, SileroVAD). Default is True.",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        default=False,
        help="Force use of mock models even if --real is default.",
    )
    parser.add_argument(
        "--language",
        type=str,
        default=None,
        help="Language code for transcription (e.g. 'vi', 'en'). Overrides settings.",
    )
    parser.add_argument(
        "--visualize",
        action="store_true",
        help="Enable Rich TUI dashboard visualization.",
    )
    parser.add_argument(
        "--play",
        action="store_true",
        help="Play audio through speakers while simulating.",
    )
    return parser


def stream_chunks(
    audio_path: Path, settings: WorkerSettings, vad: BaseVoiceActivityDetector
) -> Iterator:
    yield from generate_vad_audio_chunks(
        file_path=audio_path,
        vad=vad,
        expected_sample_rate=settings.expected_sample_rate,
        chunk_duration_seconds=settings.chunk_duration_seconds,
        overlap_duration_seconds=settings.overlap_duration_seconds,
    )


def resolve_settings(args: argparse.Namespace) -> WorkerSettings:
    settings = get_settings()
    overrides = {}
    if args.chunk_duration is not None:
        overrides["chunk_duration_seconds"] = args.chunk_duration
    if args.stream_delay_ratio is not None:
        overrides["stream_delay_ratio"] = args.stream_delay_ratio
    if args.expected_sample_rate is not None:
        overrides["expected_sample_rate"] = args.expected_sample_rate
    if args.language is not None:
        overrides["language"] = args.language

    # Enable real models via CLI flag or settings
    use_real = (args.real or settings.use_real_models) and not args.mock
    if use_real:
        overrides["use_real_models"] = True
        # Auto-adjust chunk duration for real models if not explicitly overridden
        if args.chunk_duration is None:
            overrides["chunk_duration_seconds"] = (
                settings.real_model_chunk_duration_seconds
            )
            overrides["overlap_duration_seconds"] = (
                settings.real_model_overlap_duration_seconds
            )
    else:
        overrides["use_real_models"] = False

    if not overrides:
        return settings
    return settings.model_copy(update=overrides)


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()
    settings = resolve_settings(args)
    configure_cuda_dlls(settings)

    # Disable normal logs if visualizing to avoid TUI corruption
    if not args.visualize:
        configure_logging(settings.log_level)

    audio_path = args.audio_path.resolve()
    if not audio_path.exists():
        logger.error(f"Audio file does not exist: {audio_path}")
        return 1

    # Initialize shared in-memory registry for this session
    registry = SpeakerRegistry(
        match_threshold=settings.speaker_match_threshold,
        glue_threshold=settings.speaker_glue_threshold,
        merge_threshold=settings.speaker_merge_threshold,
    )
    pipeline = build_pipeline(settings, registry=registry)

    if not args.visualize:
        logger.info(f"Starting local stream simulation for {audio_path.name}")

    all_segments = []

    if args.visualize:
        from kapter_ai_worker.simulator.player import AudioPlayer
        from kapter_ai_worker.simulator.visualizer import MeetingVisualizer

        player = AudioPlayer(audio_path)
        visualizer = MeetingVisualizer(title=f"Kapter AI: {audio_path.name}")

        if args.play:
            player.start()

        chunks = list(stream_chunks(audio_path, settings, pipeline._vad))
        chunk_idx = 0

        from rich.live import Live

        # Suppress all stderr during TUI to prevent jumping
        import contextlib

        with open(os.devnull, "w") as devnull:
            with contextlib.redirect_stderr(devnull):
                with Live(visualizer.layout, refresh_per_second=10) as live:
                    start_wall_time = time.time()

                    while chunk_idx < len(chunks):
                        current_time = (
                            player.get_current_time()
                            if args.play
                            else (time.time() - start_wall_time)
                        )

                        # Process if it's time
                        target_chunk = chunks[chunk_idx]
                        if current_time >= target_chunk.start_time:
                            # Visual sequence: step by step flow
                            visualizer.update_pipeline("VAD", True)
                            time.sleep(0.05)  # Pulse visibility

                            result = pipeline.process_chunk(target_chunk)

                            visualizer.update_pipeline("ASR", True)
                            time.sleep(0.05)
                            visualizer.update_pipeline("Diarization", True)

                            if not result.skipped:
                                for segment in result.emitted_segments:
                                    visualizer.add_segment(segment)
                                    all_segments.append(segment)

                            time.sleep(0.1)
                            visualizer.update_pipeline("VAD", False)
                            visualizer.update_pipeline("ASR", False)
                            visualizer.update_pipeline("Diarization", False)

                            chunk_idx += 1

                        # Dynamic layout updates
                        visualizer.layout["header"].update(visualizer._get_header())
                        visualizer.layout["transcript"].update(
                            visualizer._get_transcript(current_time)
                        )
                        visualizer.layout["pipeline"].update(
                            visualizer._get_pipeline_status()
                        )
                        visualizer.layout["footer"].update(
                            visualizer._get_footer(player)
                        )

                        time.sleep(0.05)

                    # Wait for audio to finish IF audio is playing
                    while (
                        args.play and player.get_current_time() < player.duration - 0.1
                    ):
                        current_time = player.get_current_time()
                        visualizer.layout["footer"].update(
                            visualizer._get_footer(player)
                        )
                        time.sleep(0.1)

                    if args.play:
                        player.stop()

    else:
        # Standard CLI Output
        try:
            for audio_chunk in stream_chunks(audio_path, settings, pipeline._vad):
                logger.info(
                    f"[{format_timestamp(audio_chunk.start_time)}] Processing..."
                )
                result = pipeline.process_chunk(audio_chunk)
                if not result.skipped:
                    for segment in result.emitted_segments:
                        logger.success(f'[{segment.speaker_label}]: "{segment.text}"')
                        all_segments.append(segment)
                if settings.stream_delay_ratio > 0:
                    time.sleep(
                        audio_chunk.duration_seconds * settings.stream_delay_ratio
                    )
        except Exception as error:
            logger.exception(f"Simulation failed: {error}")
            return 1

    # Final summary (only if not in TUI or after TUI exits)
    if all_segments and not args.visualize:
        final_segments = consolidate_segments(all_segments, registry=registry)
        for segment in final_segments:
            logger.success(
                f'[{format_timestamp(segment.start_time)}] {segment.speaker_label}: "{segment.text}"'
            )

    return 0


if __name__ == "__main__":
    sys.exit(main())