from __future__ import annotations

import time
from datetime import timedelta
from typing import TYPE_CHECKING

from rich.console import Console, Group
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn
from rich.table import Table
from rich.text import Text

if TYPE_CHECKING:
    from kapter_ai_worker.core.entities import DiarizedTranscriptSegment
    from kapter_ai_worker.simulator.player import AudioPlayer


class MeetingVisualizer:
    """TUI Visualizer for a live meeting simulation."""

    def __init__(self, title: str = "Parallel Meeting Simulator") -> None:
        self.console = Console()
        self.title = title
        self.segments: list[DiarizedTranscriptSegment] = []
        self.active_pipeline = {"VAD": False, "ASR": False, "Diarization": False}
        self.layout = self._make_layout()
        self.speaker_colors = {
            "SPEAKER_00": "bold cyan",
            "SPEAKER_01": "bold magenta",
            "SPEAKER_02": "bold green",
            "SPEAKER_UNKNOWN": "dim white",
        }

    def _make_layout(self) -> Layout:
        """Create the dashboard layout."""
        layout = Layout()
        layout.split(
            Layout(name="header", size=3),
            Layout(name="main", ratio=1),
            Layout(name="footer", size=3),
        )
        layout["main"].split_row(
            Layout(name="transcript", ratio=2),
            Layout(name="pipeline", ratio=1),
        )
        return layout

    def update_pipeline(self, component: str, active: bool) -> None:
        self.active_pipeline[component] = active

    def add_segment(self, segment: DiarizedTranscriptSegment) -> None:
        if self.segments and self.segments[-1].speaker_label == segment.speaker_label and (segment.start_time - self.segments[-1].end_time) < 1.0:
            last = self.segments[-1]
            last.text = f"{last.text} {segment.text}"
            last.end_time = max(last.end_time, segment.end_time)
            # We can skip updating self.speaker_colors since the speaker already exists
        else:
            self.segments.append(segment)
            # Auto-assign colors for new speakers
            if segment.speaker_label not in self.speaker_colors:
                colors = ["bold yellow", "bold blue", "bold red", "bold white"]
                idx = len(self.speaker_colors) % len(colors)
                self.speaker_colors[segment.speaker_label] = colors[idx]

    def _get_header(self) -> Panel:
        return Panel(
            Text(self.title, style="bold white on blue", justify="center"),
            border_style="blue",
        )

    def _get_footer(self, player: AudioPlayer) -> Panel:
        current = player.get_current_time()
        total = player.duration
        
        progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=None),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("({task.completed:.1f}s / {task.total:.1f}s)"),
        )
        task_id = progress.add_task("Playback", total=total, completed=current)
        
        return Panel(progress, title="Meeting Progress", border_style="cyan")

    def _get_pipeline_status(self) -> Panel:
        table = Table(box=None, expand=True)
        table.add_column("Component", style="dim")
        table.add_column("Status", justify="right")

        for comp, active in self.active_pipeline.items():
            if active:
                # Use a pulsing green dot or spinner
                status = "[bold green]● ACTIVE[/bold green]"
            else:
                status = "[dim]○ IDLE[/dim]"
            table.add_row(comp, status)

        return Panel(table, title="Pipeline Lane Monitor", border_style="yellow")

    def _get_transcript(self, current_time: float) -> Panel:
        table = Table(box=None, expand=True, show_header=False)
        table.add_column("Time", style="dim", width=12)
        table.add_column("Speaker", width=15)
        table.add_column("Text")

        # Show only last 3 segments to prevent vertical text pushing out of the layout bounds
        # If segments contain many lines, they can cause the Rich Layout to silently truncate the bottom.
        visible_segments = self.segments[-3:]
        for seg in visible_segments:
            color = self.speaker_colors.get(seg.speaker_label, "white")
            
            # Highlight if the segment ended very recently (active feeling)
            is_active = (current_time - 1.0) <= seg.end_time <= (current_time + 0.5)
            speaker_style = f"reverse {color}" if is_active else color
            
            ts_range = f"{timedelta(seconds=int(seg.start_time))}->{timedelta(seconds=int(seg.end_time))}"
            table.add_row(
                ts_range,
                Text(seg.speaker_label, style=speaker_style),
                seg.text
            )

        return Panel(table, title="Live Dynamic Transcript", border_style="magenta")

    def run(self, player: AudioPlayer) -> None:
        """Start the live display loop."""
        with Live(self.layout, refresh_per_second=10) as live:
            while player.get_current_time() < player.duration:
                # Update visual state
                current_time = player.get_current_time()
                self.layout["header"].update(self._get_header())
                self.layout["transcript"].update(self._get_transcript(current_time))
                self.layout["pipeline"].update(self._get_pipeline_status())
                self.layout["footer"].update(self._get_footer(player))
                
                time.sleep(0.1)
                
            # Final update
            self.layout["footer"].update(self._get_footer(player))
