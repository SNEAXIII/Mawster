#!/usr/bin/env python3
"""Verify a Cypress spec split kept its tests coherent.

Run this after redistributing `it()` blocks from one big spec into several
smaller files. It checks three things the split must not break:

  1. Count conservation — no test silently lost or duplicated.
  2. No duplicate `describe::it` titles across the new files (copy/paste leak).
  3. Setup preserved — every new file has a `beforeEach` truncating the DB,
     otherwise the tests run against dirty state.

Usage:
    # Derive the expected count from the original file:
    python verify_split.py --original war/synergy.cy.ts war/synergy/*.cy.ts

    # Or assert an explicit count (e.g. when the original is already deleted):
    python verify_split.py --expected 42 war/synergy/*.cy.ts

Exit code is 0 only when every check passes, so it slots into CI / pre-commit.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

IT_RE = re.compile(r"^\s*(?:it|test)(?:\.(?:only|skip|each))?\s*\(")
DESCRIBE_RE = re.compile(r"^\s*describe(?:\.(?:only|skip))?\s*\(")
# First string literal argument: "title" | 'title' | `title`
TITLE_RE = re.compile(r"""^\s*\w+(?:\.\w+)?\s*\(\s*(['"`])(.*?)\1""")
SETUP_RE = re.compile(r"beforeEach\s*\(")
TRUNCATE_RE = re.compile(r"truncateDb")


class C:
    enabled = sys.stdout.isatty()

    @staticmethod
    def _w(code, t):
        return f"\033[{code}m{t}\033[0m" if C.enabled else t

    ok = staticmethod(lambda t: C._w("32", t))
    bad = staticmethod(lambda t: C._w("31", t))
    warn = staticmethod(lambda t: C._w("33", t))
    dim = staticmethod(lambda t: C._w("2", t))


def count_tests(path: Path) -> int:
    return sum(
        1 for ln in path.read_text(encoding="utf-8").splitlines() if IT_RE.match(ln)
    )


def describe_it_pairs(path: Path) -> list[tuple[str, str]]:
    """Return (nearest-describe-title, it-title) pairs, in file order."""
    pairs: list[tuple[str, str]] = []
    current = "<root>"
    for ln in path.read_text(encoding="utf-8").splitlines():
        if DESCRIBE_RE.match(ln):
            m = TITLE_RE.match(ln)
            current = m.group(2) if m else "<dynamic>"
        elif IT_RE.match(ln):
            m = TITLE_RE.match(ln)
            pairs.append((current, m.group(2) if m else "<dynamic>"))
    return pairs


def has_setup(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    return bool(SETUP_RE.search(text) and TRUNCATE_RE.search(text))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("files", nargs="+", help="the new split files")
    ap.add_argument("--original", help="original spec, to derive expected count")
    ap.add_argument("--expected", type=int, help="expected total it() count")
    ap.add_argument(
        "--no-setup-check",
        action="store_true",
        help="skip the beforeEach/truncateDb check",
    )
    args = ap.parse_args()

    new_files = [Path(f) for f in args.files]
    missing = [f for f in new_files if not f.exists()]
    if missing:
        print(C.bad(f"✗ missing files: {', '.join(map(str, missing))}"))
        return 2

    if args.original:
        expected = count_tests(Path(args.original))
        src = f"{args.original} ({expected} tests)"
    elif args.expected is not None:
        expected = args.expected
        src = f"--expected {expected}"
    else:
        print(C.bad("✗ provide --original or --expected"))
        return 2

    failures: list[str] = []

    # 1. Count conservation
    actual = sum(count_tests(f) for f in new_files)
    if actual == expected:
        print(C.ok(f"✓ count conserved: {actual} tests across {len(new_files)} files"))
    else:
        delta = actual - expected
        failures.append(
            f"count mismatch: expected {expected}, got {actual} "
            f"({'+' if delta > 0 else ''}{delta})"
        )
        print(C.bad(f"✗ count: expected {expected} ({src}), got {actual}"))

    # 2. Duplicate describe::it
    all_pairs: list[tuple[str, str]] = []
    for f in new_files:
        all_pairs.extend(describe_it_pairs(f))
    dupes = [k for k, n in Counter(all_pairs).items() if n > 1]
    if dupes:
        failures.append(f"{len(dupes)} duplicate test title(s)")
        print(C.bad(f"✗ duplicate titles ({len(dupes)}):"))
        for d_desc, it in dupes:
            print(C.dim(f"    {d_desc} › {it}"))
    else:
        print(C.ok(f"✓ no duplicate describe::it titles ({len(all_pairs)} unique)"))

    # 3. Setup preserved
    if not args.no_setup_check:
        no_setup = [str(f) for f in new_files if not has_setup(f)]
        if no_setup:
            failures.append(f"{len(no_setup)} file(s) missing beforeEach/truncateDb")
            print(C.warn("⚠ missing beforeEach(truncateDb):"))
            for f in no_setup:
                print(C.dim(f"    {f}"))
        else:
            print(C.ok("✓ every file truncates the DB in beforeEach"))

    print()
    if failures:
        print(C.bad("SPLIT INCOHERENT — " + "; ".join(failures)))
        return 1
    print(C.ok("SPLIT OK"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
