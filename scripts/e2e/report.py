"""Reads the per-worker Cypress and backend logs back into counts and report.json."""

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    RESULTS_DIR,
    ROOT,
    log,
    worker_log_dir,
)

# Matches the final summary line printed by Cypress after all specs:
#   "  √  All specs passed!                        01:39   60   54    -    6    -"
#   "  ×  1 of 6 failed (17%)                      01:16   55   54    1    -    -"
# Groups: tests, passing, failing, pending, skipped  ("-" means 0)
FINAL_SUMMARY_RE = re.compile(
    r"(?:passed!|failed.*?)"  # "passed!" or "failed" + optional suffix like " (17%)"
    r"\s+[\d:]+\s+"  # duration (e.g. 01:16)
    r"(\d+|-)\s+"  # tests
    r"(\d+|-)\s+"  # passing
    r"(\d+|-)\s+"  # failing
    r"(\d+|-)\s+"  # pending
    r"(\d+|-)"  # skipped
)
# Logged by the backend dev controller (api/src/controllers/dev_controller.py)
# at the start of each test; parse_backend_markers splits the backend log on it
# to attribute log lines to a test.
TEST_START_MARKER = "===TEST_START==="
STAT_KEYS = ("tests", "passing", "failing", "pending", "skipped")


@dataclass
class WorkerFailure:
    worker: int
    title: str
    cypress_error: str
    backend_logs: list[str]


def parse_cypress_failures(cypress_log: Path) -> list[dict]:
    """Parse failing tests from a cypress.log file.

    Returns a list of {"title": str, "error": str} dicts.

    Cypress stdout failure section looks like:

        2 failing

        1) describe title
             test title:
           AssertionError: expected 200 to equal 404
               at Context.<anonymous> (cypress/e2e/foo.cy.ts:42:7)

        2) ...

        (Results)
    """
    try:
        lines = cypress_log.read_text(encoding="utf-8").splitlines()
    except Exception:
        return []

    failures: list[dict] = []
    in_failures = False
    current_title: str | None = None
    current_error_lines: list[str] = []

    # Regex: "  1) some text" — numbered failure header
    failure_header_re = re.compile(r"^\s+\d+\)\s+(.+)")
    # Regex: "       test title:" — the actual it() name line (indented more)
    test_name_re = re.compile(r"^\s{7,}(.+):$")

    def flush():
        nonlocal current_title, current_error_lines
        if current_title and current_error_lines:
            error = "\n".join(ln.strip() for ln in current_error_lines if ln.strip())
            failures.append({"title": current_title, "error": error})
        current_title = None
        current_error_lines = []

    for line in lines:
        stripped = line.strip()

        if not in_failures:
            clean = re.sub(r"\x1b\[[0-9;]*m", "", stripped)
            parts = clean.split()
            if len(parts) == 2 and parts[1] == "failing" and parts[0].isdigit():
                in_failures = True
            continue

        clean = re.sub(r"\x1b\[[0-9;]*m", "", stripped)
        if clean == "(Results)":
            flush()
            break

        m_header = failure_header_re.match(line)
        if m_header:
            flush()
            current_title = m_header.group(1).strip()
            current_error_lines = []
            continue

        if current_title is not None:
            m_name = test_name_re.match(line)
            if m_name:
                current_title = f"{current_title} > {m_name.group(1).strip()}"
            else:
                current_error_lines.append(line)

    flush()
    return failures


def parse_backend_markers(backend_log: Path) -> dict[str, list[str]]:
    """Extract per-test log lines from a backend.log using ===TEST_START===/===TEST_END=== markers.

    Returns a dict mapping test title → list of log lines captured between its markers.
    """
    try:
        lines = backend_log.read_text(encoding="utf-8").splitlines()
    except Exception:
        return {}

    result: dict[str, list[str]] = {}
    current_title: str | None = None
    current_lines: list[str] = []

    for line in lines:
        if TEST_START_MARKER in line:
            idx = line.index(TEST_START_MARKER) + len(TEST_START_MARKER)
            current_title = line[idx:].strip()
            current_lines = []
        elif "===TEST_END===" in line:
            if current_title is not None:
                result[current_title] = current_lines
            current_title = None
            current_lines = []
        elif current_title is not None:
            current_lines.append(line)

    return result


def _parse_int(s: str) -> int:
    return int(s) if s != "-" else 0


def parse_cypress_stats(cypress_log: Path) -> dict:
    """Extract test counts from a cypress log file after the run completes."""
    try:
        for line in reversed(cypress_log.read_text(encoding="utf-8").splitlines()):
            m = FINAL_SUMMARY_RE.search(line)
            if m:
                return {key: _parse_int(m.group(i)) for i, key in enumerate(STAT_KEYS, start=1)}
    except Exception:
        pass
    return {}


def merge_stats(worker_stats: list[dict]) -> dict[str, int]:
    """Sum the workers' counts and log them."""
    merged: dict[str, int] = {}
    for stats in worker_stats:
        for key, val in stats.items():
            merged[key] = merged.get(key, 0) + val

    if merged:
        log("-" * 50)
        log("MERGED RESULTS (all workers combined):")
        for key in STAT_KEYS:
            log(f"  {key.capitalize():<10}: {merged.get(key, 0)}")
        log("-" * 50)
    return merged


def build_merged_report(
    merged_stats: dict,
    worker_stats: list[dict],
    total_duration: float,
) -> None:
    """Build and write front/cypress/results/report.json.

    Reads per-worker cypress.log and backend.log, correlates failures with
    backend log lines captured between ===TEST_START=== / ===TEST_END=== markers.
    """

    all_failures: list[WorkerFailure] = []

    for worker in range(len(worker_stats)):
        log_dir = worker_log_dir(worker)
        cypress_log = log_dir / "cypress.log"
        backend_log = log_dir / "backend.log"

        cypress_failures = parse_cypress_failures(cypress_log)
        backend_markers = parse_backend_markers(backend_log)

        for failure in cypress_failures:
            title = failure["title"]
            backend_logs = backend_markers.get(title, [])

            all_failures.append(
                WorkerFailure(
                    title=title,
                    worker=worker,
                    cypress_error=failure["error"],
                    backend_logs=backend_logs,
                )
            )

    workers_timing = [
        {"worker": index, "duration_seconds": worker.get("duration_seconds", 0)}
        for (index, worker) in enumerate(worker_stats)
    ]
    report = {
        "summary": {
            "tests": merged_stats.get("tests", 0),
            "passing": merged_stats.get("passing", 0),
            "failing": merged_stats.get("failing", 0),
            "total_duration_seconds": round(total_duration, 1),
            "workers": workers_timing,
        },
        "failures": [asdict(f) for f in all_failures],
    }

    out = RESULTS_DIR / "report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Report written → {out.relative_to(ROOT)}  ({len(all_failures)} failure(s))")
