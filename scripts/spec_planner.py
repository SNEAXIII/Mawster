#!/usr/bin/env python3
"""Spec discovery, weighting and distribution for the Cypress E2E suite.

Owns the planning side of the E2E suite — which specs exist, what each one
weighs, and how they spread across N buckets. The runner keeps none of it: CI
calls this module directly for the matrix, and e2e_parallel.py imports the same
functions to split specs across its local workers.

Nothing here starts a server, a database or Cypress, and importing it has no
side effects, so planning no longer drags in the whole runner (which probes the
host OS at import time).

    python3 scripts/spec_planner.py --runners 8              # matrix JSON, as CI consumes it
    python3 scripts/spec_planner.py --runners 8 --weights    # readable weight report
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
    """Estimate test weight by counting it( calls in the spec file.

    The needle keeps its two leading spaces so that `it(` inside a word (unit(,
    await(, ...) never counts; a substring match still reaches every indent
    level, so tests nested in an inner describe are weighed like the rest.
    """
    try:
        return max(1, spec.read_text(encoding="utf-8").count("  it("))
    except Exception:
        return 1


def distribute_specs(specs: list[Path], n: int) -> list[list[Path]]:
    """Greedy bin-packing: assign heaviest specs first to the lightest bucket."""
    weighted = sorted(((s, count_tests(s)) for s in specs), key=lambda x: x[1], reverse=True)
    buckets: list[list[Path]] = [[] for _ in range(n)]
    totals = [0] * n
    for spec, w in weighted:
        i = min(range(n), key=lambda i: totals[i])
        buckets[i].append(spec)
        totals[i] += w
    log(f"Spec distribution (estimated tests per worker): {totals}")
    return buckets


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


def build_matrix(runners: int, include_vision: bool = False) -> list[dict]:
    """Return the GitHub Actions matrix entries, one per non-empty bucket.

    Each entry is {"runner": "N", "specs": "path1,path2,..."} with paths
    relative to FRONT_DIR (forward-slash, cross-platform).

    Vision specs are left out: they need a broker, object storage and a single
    vision worker, which the parallel runners do not have. Spread across the
    matrix they would also put two consumers on the same queue.
    """
    buckets = distribute_specs(get_spec_files(include_vision=include_vision), runners)
    return [
        {
            "runner": str(i),
            "specs": ",".join(str(s.relative_to(FRONT_DIR)).replace("\\", "/") for s in bucket),
        }
        for i, bucket in enumerate(buckets)
        if bucket
    ]


def plan(runners: int, include_vision: bool = False) -> None:
    """Print the GitHub Actions matrix JSON and exit."""
    print(json.dumps(build_matrix(runners, include_vision=include_vision)))
    sys.exit(0)


def report_weights(runners: int, include_vision: bool = False) -> None:
    """Print what each spec weighs and how the buckets came out."""
    specs = get_spec_files(include_vision=include_vision)
    weights = sorted(((count_tests(s), s) for s in specs), reverse=True)
    total = sum(w for w, _ in weights)

    print(f"{len(specs)} specs, {total} tests\n")
    print(f"{'tests':>5}  spec")
    for weight, spec in weights:
        print(f"{weight:>5}  {spec.relative_to(E2E_DIR)}")

    buckets = distribute_specs(specs, runners)
    print(f"\n{runners} runners:")
    for i, bucket in enumerate(buckets):
        print(
            f"  runner {i}: {sum(count_tests(s) for s in bucket):>4} tests, {len(bucket):>3} specs"
        )


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
        report_weights(args.runners, include_vision=args.include_vision)
        return
    plan(args.runners, include_vision=args.include_vision)


if __name__ == "__main__":
    main()
