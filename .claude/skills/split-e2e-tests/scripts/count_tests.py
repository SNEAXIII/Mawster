#!/usr/bin/env python3
"""Rank Cypress E2E specs by test count to surface split candidates.

A "split candidate" is a spec whose number of `it()` blocks exceeds a
threshold — those files usually mix several test objectives and are worth
splitting into smaller, purpose-focused files (optionally under a sub-folder).

Usage:
    python count_tests.py                      # scan front/cypress/e2e, top 10
    python count_tests.py front/cypress/e2e/war --top 30
    python count_tests.py --threshold 12 --all
    python count_tests.py --json              # machine-readable, no colors

The output is a ranked table with bars; specs over the threshold are flagged.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

DEFAULT_ROOT = "front/cypress/e2e"
DEFAULT_THRESHOLD = 15

# `it(`, `test(`, `it.only(`, `it.skip(` — robust to spacing and modifiers.
IT_RE = re.compile(r"^\s*(?:it|test)(?:\.(?:only|skip|each))?\s*\(")
SKIP_RE = re.compile(r"^\s*(?:xit\b|it\.skip\s*\(|xtest\b|test\.skip\s*\()")
DESCRIBE_RE = re.compile(r"^\s*describe(?:\.(?:only|skip))?\s*\(")


class C:
    """ANSI colors — disabled automatically when output is not a TTY."""

    enabled = sys.stdout.isatty()

    @classmethod
    def _w(cls, code: str, text: str) -> str:
        return f"\033[{code}m{text}\033[0m" if cls.enabled else text

    @classmethod
    def dim(cls, t):
        return cls._w("2", t)

    @classmethod
    def bold(cls, t):
        return cls._w("1", t)

    @classmethod
    def red(cls, t):
        return cls._w("31", t)

    @classmethod
    def yellow(cls, t):
        return cls._w("33", t)

    @classmethod
    def green(cls, t):
        return cls._w("32", t)

    @classmethod
    def cyan(cls, t):
        return cls._w("36", t)


@dataclass
class SpecStats:
    path: str
    tests: int
    skipped: int
    describes: int


def analyze(file: Path) -> SpecStats:
    tests = skipped = describes = 0
    for line in file.read_text(encoding="utf-8").splitlines():
        if IT_RE.match(line):
            tests += 1
            if SKIP_RE.match(line):
                skipped += 1
        elif DESCRIBE_RE.match(line):
            describes += 1
    return SpecStats(str(file), tests, skipped, describes)


def collect(root: Path) -> list[SpecStats]:
    specs = [analyze(p) for p in sorted(root.rglob("*.cy.ts"))]
    return sorted(specs, key=lambda s: s.tests, reverse=True)


def bar(count: int, peak: int, width: int = 24) -> str:
    if peak <= 0:
        return ""
    filled = round(count / peak * width)
    return "█" * filled + C.dim("·" * (width - filled))


def render(specs: list[SpecStats], root: Path, threshold: int, top: int) -> None:
    shown = specs if top <= 0 else specs[:top]
    peak = specs[0].tests if specs else 0
    name_w = max((len(s.path) for s in shown), default=10)

    print()
    print(" " + C.bold("Cypress E2E spec sizes") + C.dim(f"  ({root})"))
    print(" " + C.dim("─" * (name_w + 40)))
    for s in shown:
        over = s.tests >= threshold
        num = f"{s.tests:>3}"
        num = C.red(num) if over else C.green(num)
        name = s.path.ljust(name_w)
        name = C.yellow(name) if over else name
        flag = C.red(" ⚠ split") if over else ""
        skip = C.dim(f" ({s.skipped} skip)") if s.skipped else ""
        print(f"  {num}  {name}  {bar(s.tests, peak)}{flag}{skip}")
    print(" " + C.dim("─" * (name_w + 40)))

    total_tests = sum(s.tests for s in specs)
    total_skip = sum(s.skipped for s in specs)
    over_n = sum(1 for s in specs if s.tests >= threshold)
    summary = (
        f"{len(specs)} files · {total_tests} tests"
        + (f" · {total_skip} skipped" if total_skip else "")
        + f" · threshold {threshold} · "
        + (C.red(f"{over_n} over") if over_n else C.green("0 over"))
    )
    print("  " + C.cyan(summary))
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("root", nargs="?", default=DEFAULT_ROOT, help="dir to scan")
    ap.add_argument("--top", type=int, default=10, help="rows to show (0 = all)")
    ap.add_argument("--all", action="store_true", help="show every spec")
    ap.add_argument(
        "--threshold",
        type=int,
        default=DEFAULT_THRESHOLD,
        help="it() count flagged as a split candidate",
    )
    ap.add_argument("--json", action="store_true", help="emit JSON, no table")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"error: {root} not found", file=sys.stderr)
        return 2

    specs = collect(root)
    if args.json:
        print(json.dumps([asdict(s) for s in specs], indent=2))
        return 0

    render(specs, root, args.threshold, 0 if args.all else args.top)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
