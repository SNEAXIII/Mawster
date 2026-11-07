"""Chart how many jobs sit in each worker stage over time, from the worker's own log.

    make worker        # writes out/worker.log
    make timeline      # writes out/job_timeline.png

Stages are counted from log events, not job ids: `make publish-job COPIES=n` reuses one id.
"""

from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

LOG = Path("out/worker.log")
OUTPUT = Path("out/job_timeline.png")

SURFACE = "#fcfcfb"
TEXT = "#52514e"
GRID = "#e4e3df"
STAGES = {
    "prefetch": ("Prefetched (derived)", "#2a78d6"),
    "consumer": ("Download / waiting for inference", "#eb6834"),
    "inference": ("Inference", "#1baf7a"),
    "waiting": ("Waiting for publish", "#eda100"),
    "publishing": ("Publishing", "#e87ba4"),
}
# Log message -> (stage left, stage entered).
TRANSITIONS = {
    "job received": (None, "consumer"),
    "inference started": ("consumer", "inference"),
    "inference finished": ("inference", "waiting"),
    "skipping inference": ("consumer", "waiting"),
    "publish started": ("waiting", "publishing"),
    "job acked": ("publishing", None),
    "requeuing": ("publishing", None),
}
ANSI = re.compile(r"\x1b\[[0-9;]*m")
TIMESTAMP = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+)Z")
CAPACITIES = re.compile(
    r"worker capacities prefetch=(?P<prefetch>\d+)"
    r" inference_channel=(?P<inference>\d+) results_channel=(?P<results>\d+)"
)


def parse_events(lines: list[str]) -> list[tuple[datetime, str]]:
    """Keeps the log lines that move a job, oldest first, as (time, message)."""
    events = []
    for line in lines:
        clean = ANSI.sub("", line)
        stamp = TIMESTAMP.match(clean)
        message = next((m for m in TRANSITIONS if m in clean), None)
        if stamp and message:
            events.append((datetime.fromisoformat(stamp[1]), message))
    return events


def parse_capacities(lines: list[str]) -> dict[str, int] | None:
    """The capacities the logged worker really ran with, None on a log without them."""
    found = CAPACITIES.search(ANSI.sub("", "\n".join(lines)))
    return (
        {key: int(value) for key, value in found.groupdict().items()} if found else None
    )


def replay(
    events: list[tuple[datetime, str]], prefetch: int
) -> tuple[list[float], dict[str, list[int]], list[int]]:
    """Times in ms, jobs per stage after each event, and acked jobs so far.

    The broker's buffer leaves no log, so `prefetch` is derived: the free slots, capped
    by the jobs still to arrive. It overstates a queue that fills while the run goes on.
    """
    jobs_left = sum(message == "job received" for _, message in events)
    counts = dict.fromkeys(STAGES, 0)
    times, acked, total_acked = [], [], 0
    series: dict[str, list[int]] = {stage: [] for stage in STAGES}
    for when, message in events:
        left, entered = TRANSITIONS[message]
        if left:
            counts[left] -= 1
        if entered:
            counts[entered] += 1
        jobs_left -= message == "job received"
        total_acked += message == "job acked"
        in_flight = sum(n for stage, n in counts.items() if stage != "prefetch")
        counts["prefetch"] = max(0, min(prefetch - in_flight, jobs_left))
        times.append((when - events[0][0]).total_seconds() * 1000)
        acked.append(total_acked)
        for stage in STAGES:
            series[stage].append(counts[stage])
    return times, series, acked


def draw(
    times: list[float],
    series: dict[str, list[int]],
    acked: list[int],
    capacities: dict[str, int],
    output: Path,
) -> None:
    figure, (stages, done) = plt.subplots(
        2,
        1,
        sharex=True,
        figsize=(12, 6),
        height_ratios=[3, 1],
        facecolor=SURFACE,
        layout="constrained",
    )
    stages.stackplot(
        times,
        [series[stage] for stage in STAGES],
        labels=[label for label, _ in STAGES.values()],
        colors=[color for _, color in STAGES.values()],
        step="post",
        edgecolor=SURFACE,
        linewidth=1,
    )
    stages.set_ylabel("Jobs held by the worker", color=TEXT)
    stages.set_ylim(0, capacities["prefetch"])
    figure.suptitle(
        f"prefetch {capacities['prefetch']}"
        f" · inference channel {capacities['inference']}"
        f" · results channel {capacities['results']}",
        color=TEXT,
    )
    stages.yaxis.get_major_locator().set_params(integer=True)
    stages.legend(
        loc="upper center", bbox_to_anchor=(0.5, 1.13), ncols=5, frameon=False
    )
    done.step(times, acked, where="post", color=STAGES["prefetch"][1], linewidth=2)
    done.set_ylabel("Acked (total)", color=TEXT)
    done.set_xlabel("Time since the first job (ms)", color=TEXT)
    for axis in (stages, done):
        axis.set_facecolor(SURFACE)
        axis.grid(axis="y", color=GRID, linewidth=0.8)
        axis.set_axisbelow(True)
        axis.tick_params(colors=TEXT, length=0)
        axis.spines[["top", "right", "left"]].set_visible(False)
        axis.spines["bottom"].set_color(GRID)
    figure.savefig(output, dpi=150)


def main() -> None:
    log = Path(sys.argv[1]) if len(sys.argv) > 1 else LOG
    lines = log.read_text(encoding="utf-8", errors="replace").splitlines()
    events = parse_events(lines)
    if not events:
        sys.exit(f"no job event in {log}: run `make worker`, then `make publish-job`")
    capacities = parse_capacities(lines)
    if capacities is None:
        sys.exit(f"no capacities in {log}: it predates them, rerun `make worker`")
    draw(*replay(events, capacities["prefetch"]), capacities, OUTPUT)
    print(f"{len(events)} events -> {OUTPUT}")


if __name__ == "__main__":
    main()
