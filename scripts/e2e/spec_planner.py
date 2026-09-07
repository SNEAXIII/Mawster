#!/usr/bin/env python3
"""Spec discovery, weighting and distribution for the Cypress E2E suite.

CI calls this for the matrix; e2e_parallel.py imports the same functions to
resolve the lanes it is handed.

Specs are balanced across `runners * workers` lanes rather than across runners:
a runner is done when its slowest worker is done, so the lane — one worker's
share — is the unit worth balancing.

    python3 scripts/e2e/spec_planner.py --runners 8 --workers 2            # matrix JSON, as CI consumes it
    python3 scripts/e2e/spec_planner.py --runners 8 --workers 2 --weights  # readable weight report
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    FRONT_DIR,
    log,
)

# Mirrors specPattern in front/cypress.config.ts.
SPEC_GLOB = "*.cy.ts"
E2E_DIR = FRONT_DIR / "cypress" / "e2e"

# Separates the per-worker lanes inside one runner's --spec value. A runner is
# only a machine: the unit that actually runs specs is a worker, so the planner
# balances lanes, not runners, and hands each runner its lanes already split.
LANE_SEPARATOR = "|"

# Specs whose filename contains this marker exercise the vision import loop:
# front -> API -> RabbitMQ -> worker -> API -> preview. They need RabbitMQ,
# RustFS and a vision worker running, and only ONE worker may consume
# `vision.jobs` at a time or message delivery stops being deterministic.
#
# Ordinary runners have none of that, so they are excluded by default and opted
# into with --include-vision. They are meant to land on a single dedicated
# runner with the full stack, never spread across the parallel matrix.
VISION_SPEC_MARKER = "vision"


def is_vision_spec(spec: Path) -> bool:
    return VISION_SPEC_MARKER in spec.name


def get_spec_files(include_vision: bool = False) -> list[Path]:
    """Return Cypress spec files sorted by path.

    Vision specs are excluded unless asked for: see VISION_SPEC_MARKER.
    """
    specs = sorted(E2E_DIR.rglob(SPEC_GLOB))
    if include_vision:
        return specs
    return [s for s in specs if not is_vision_spec(s)]


def count_tests(spec: Path) -> int:
    """Estimate test weight by counting it( calls in the spec file."""
    try:
        return max(1, spec.read_text(encoding="utf-8").count("  it("))
    except Exception:
        return 1


def distribute_specs(
    specs: list[Path], n_buckets: int, *, label: str = "worker"
) -> list[list[Path]]:
    """Greedy bin-packing: assign heaviest specs first to the lightest bucket.

    Called at both levels of the split — across CI runners by build_matrix, then
    across the workers of one runner by e2e_parallel — hence `label`, so the log
    line says which one it is talking about.
    """
    weighted = sorted(((s, count_tests(s)) for s in specs), key=lambda x: x[1], reverse=True)
    buckets: list[list[Path]] = [[] for _ in range(n_buckets)]
    totals = [0] * n_buckets
    for spec, w in weighted:
        i = min(range(n_buckets), key=lambda i: totals[i])
        buckets[i].append(spec)
        totals[i] += w
    log(f"Spec distribution (estimated tests per {label}): {totals}")
    return buckets


def resolve_spec_lanes(raw_specs: str) -> list[list[Path]]:
    """Split a --spec value into the per-worker lanes the planner laid out.

    A value without LANE_SEPARATOR is a single lane — a hand-typed --spec keeps
    working untouched.
    """
    return [
        sorted(resolve_spec_paths(part)) for part in raw_specs.split(LANE_SEPARATOR) if part.strip()
    ]


def resolve_spec_paths(raw_specs: str) -> set[Path]:
    resolved_specs: set[Path] = set()
    for raw in [s.strip() for s in raw_specs.split(",") if s.strip()]:
        spec_path = Path(raw)
        if not spec_path.is_absolute():
            candidate = E2E_DIR / raw
            if not candidate.exists():
                candidate = FRONT_DIR / raw
            spec_path = candidate
        if not spec_path.exists():
            available = sorted(p.relative_to(E2E_DIR) for p in E2E_DIR.rglob(SPEC_GLOB))
            log(f"ERROR: spec not found: {raw}")
            log("Available specs:")
            for s in available:
                log(f"  {s}")
            sys.exit(1)
        if spec_path.is_dir():
            resolved_specs.update(spec_path.rglob(SPEC_GLOB))
        else:
            resolved_specs.add(spec_path)
    return resolved_specs


def _lane_weight(lane: list[Path]) -> int:
    return sum(count_tests(s) for s in lane)


def _group_lanes(lanes: list[list[Path]], runners: int, workers: int) -> list[list[list[Path]]]:
    """Deal the lanes to the runners snake-wise, heaviest first.

    Balancing lanes is what matters — a runner's duration is the slowest of its
    workers, not their sum — but dealing back and forth keeps runner totals level
    too, so no machine is left holding every heavy lane.
    """
    ordered = sorted(lanes, key=_lane_weight, reverse=True)
    grouped: list[list[list[Path]]] = [[] for _ in range(runners)]
    for turn in range(workers):
        chunk = ordered[turn * runners : (turn + 1) * runners]
        if turn % 2:
            chunk = list(reversed(chunk))
        for runner_index, lane in enumerate(chunk):
            grouped[runner_index].append(lane)
    return grouped


def _relative(spec: Path) -> str:
    return str(spec.relative_to(FRONT_DIR)).replace("\\", "/")


def build_matrix(runners: int, workers: int = 1, include_vision: bool = False) -> list[dict]:
    """Return the GitHub Actions matrix entries, one per non-empty runner.

    Specs are balanced across `runners * workers` lanes, not across runners: a
    runner waits for its slowest worker, so a lane is the real unit of work.
    Each entry is {"runner": "N", "specs": "lane1specs|lane2specs"} with paths
    relative to FRONT_DIR (forward-slash, cross-platform), lanes separated by
    LANE_SEPARATOR so e2e_parallel hands each worker the lane planned for it.
    """
    lanes = distribute_specs(
        get_spec_files(include_vision=include_vision), runners * workers, label="lane"
    )
    return [
        {
            "runner": str(i),
            "specs": LANE_SEPARATOR.join(
                ",".join(_relative(s) for s in lane) for lane in runner_lanes if lane
            ),
        }
        for i, runner_lanes in enumerate(_group_lanes(lanes, runners, workers))
        if any(runner_lanes)
    ]


def plan(runners: int, workers: int = 1, include_vision: bool = False) -> None:
    print(json.dumps(build_matrix(runners, workers, include_vision=include_vision)))
    sys.exit(0)


def report_weights(runners: int, workers: int = 1, include_vision: bool = False) -> None:
    specs = get_spec_files(include_vision=include_vision)
    weights = sorted(((count_tests(s), s) for s in specs), reverse=True)
    total = sum(w for w, _ in weights)

    print(f"{len(specs)} specs, {total} tests\n")
    print(f"{'tests':>5}  spec")
    for weight, spec in weights:
        print(f"{weight:>5}  {spec.relative_to(E2E_DIR)}")

    lanes = distribute_specs(specs, runners * workers, label="lane")
    grouped = _group_lanes(lanes, runners, workers)
    print(f"\n{runners} runners x {workers} worker(s) = {runners * workers} lanes:")
    for i, runner_lanes in enumerate(grouped):
        detail = "  ".join(
            f"lane {_lane_weight(lane):>3} ({len(lane)} specs)" for lane in runner_lanes
        )
        slowest = max(_lane_weight(lane) for lane in runner_lanes)
        print(f"  runner {i}: {detail}   -> slowest lane {slowest}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--runners",
        type=int,
        default=4,
        metavar="N",
        help="Number of CI runners to distribute specs across (default: 4).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        metavar="N",
        help="Workers per runner (default: 1). Specs are balanced across runners * workers lanes.",
    )
    parser.add_argument(
        "--weights",
        action="store_true",
        help="Print a readable weight report instead of the matrix JSON.",
    )
    parser.add_argument(
        "--include-vision",
        action="store_true",
        help="Include the vision specs, excluded by default.",
    )
    args = parser.parse_args()

    if args.weights:
        report_weights(args.runners, args.workers, include_vision=args.include_vision)
        return
    plan(args.runners, args.workers, include_vision=args.include_vision)


if __name__ == "__main__":
    main()
