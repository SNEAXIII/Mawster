#!/usr/bin/env python3
"""
E2E parallel test runner for Mawster — CI only (.github/workflows/_test.yaml).

Usage:
    python3 scripts/e2e/e2e_parallel.py --spec "<lanes from spec_planner.py>"

Each lane N gets its own worker:
  - Backend on port 8010+N  (MariaDB DB: mawster_test_N)
  - Frontend on port 3010+N (next start serving the .next-e2e build from the e2e-build job)
  - Cypress instance running that lane's specs
"""

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    API_DIR,
    BASE_API_PORT,
    BASE_CDP_PORT,
    BASE_FRONT_PORT,
    DB_PREFIX,
    FRONT_DIR,
    HEALTH_TIMEOUT,
    MARIADB_PORT,
    ROOT,
    STATIC_PORT,
    log,
)
from spec_planner import (  # pylint: disable=import-error,wrong-import-position
    resolve_spec_lanes,
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


@dataclass
class WorkerFailure:
    worker: int
    title: str
    cypress_error: str
    backend_logs: list[str]


ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mKHFABCDJG]")
RESULTS_DIR = FRONT_DIR / "cypress" / "results"
# Next build output for E2E, separate from the dev .next. The same value
# is spelled out in .github/workflows/_test.yaml and
# front/tsconfig.json, so renaming it here alone is not enough.
NEXT_E2E_DIST = ".next-e2e"
# Logged by the backend dev controller (api/src/controllers/dev_controller.py)
# at the start of each test; parse_backend_markers splits the backend log on it
# to attribute log lines to a test.
TEST_START_MARKER = "===TEST_START==="


def worker_log_dir(worker: int) -> Path:
    return RESULTS_DIR / "workers" / f"worker-{worker}"


def localhost_url(port: int, path: str = "") -> str:
    return f"http://localhost:{port}{path}"


def get_db_name(worker: int) -> str:
    """Return the database name for this worker.

    Nothing here creates it: app_testing.py does, from the backend process that
    owns it — which is also what waits for MariaDB to accept connections.
    """
    return f"{DB_PREFIX}{worker}"


def wait_for_http(url: str, label: str, timeout: int = HEALTH_TIMEOUT) -> None:
    """Poll url until HTTP response received (any status code = server is up)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            log(f"{label} ready at {url}")
            return
        except urllib.error.HTTPError:
            # Any HTTP error means the server responded — it's up
            log(f"{label} ready at {url}")
            return
        except Exception:
            time.sleep(0.5)
    msg = f"{label} at {url} did not become ready within {timeout}s"
    raise TimeoutError(msg)


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


def _parse_int(s: str) -> int:
    return int(s) if s != "-" else 0


def pipe_output(
    stream,
    prefix: str,
    quiet: bool = False,
    log_file: Path | None = None,
) -> None:
    """Read lines from a subprocess stream, print with prefix, and write to log file."""
    try:
        fh = log_file.open("w", encoding="utf-8") if log_file else None
        try:
            for line in iter(stream.readline, b""):
                decoded = line.decode(errors="replace").rstrip()
                if not quiet:
                    print(f"{prefix} {decoded}")
                if fh:
                    fh.write(ANSI_ESCAPE.sub("", decoded) + "\n")
        finally:
            if fh:
                fh.close()
    except Exception:
        pass


def parse_cypress_stats(cypress_log: Path) -> dict:
    """Extract test counts from a cypress log file after the run completes."""
    try:
        for line in reversed(cypress_log.read_text(encoding="utf-8").splitlines()):
            m = FINAL_SUMMARY_RE.search(line)
            if m:
                return {
                    "tests": _parse_int(m.group(1)),
                    "passing": _parse_int(m.group(2)),
                    "failing": _parse_int(m.group(3)),
                    "pending": _parse_int(m.group(4)),
                    "skipped": _parse_int(m.group(5)),
                }
    except Exception:
        pass
    return {}


def start_backend(worker: int, base_env: dict) -> None:
    api_port = BASE_API_PORT + worker
    db = get_db_name(worker)
    env = {
        **base_env,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
        "MARIADB_PORT": str(MARIADB_PORT),
        "PORT": str(api_port),
        "PYTHONIOENCODING": "utf-8",
        # Without this, print() is block-buffered into a pipe and lost when the
        # process is killed on timeout — including reset_db's "Attempt N failed"
        # lines, which are the only place the real startup error is reported.
        "PYTHONUNBUFFERED": "1",
    }
    log(f"Worker {worker}: starting backend  — PORT={api_port}  DB={db}  MODE=testing")
    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        ["uv", "run", "app_testing.py"],
        cwd=str(API_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    prefix = f"[W{worker}|api:{api_port}]"
    threading.Thread(
        target=pipe_output,
        args=(proc.stdout, prefix, True),
        kwargs={"log_file": log_dir / "backend.log"},
        daemon=True,
    ).start()


def start_static_server() -> None:
    """Serve static-assets/ locally: otherwise the /static rewrite targets the Docker-only
    `static` host, and every image stalls `next start` on a DNS lookup that never succeeds."""
    log(f"Starting static assets server — PORT={STATIC_PORT}")
    subprocess.Popen(
        [sys.executable, "-m", "http.server", str(STATIC_PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT / "static-assets"),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def start_frontend(worker: int, base_env: dict) -> None:
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    env = {
        **base_env,
        "PORT": str(front_port),
        "API_PORT": str(api_port),
        "API_SERVER_HOST": "localhost",
        "NEXTAUTH_URL": localhost_url(front_port),
        "WORKER_ID": str(worker),
        "NEXT_DIST_DIR": NEXT_E2E_DIST,
        "NEXT_E2E_BUILD": "true",
        "DEV_MODE": "true",
        "PYTHONIOENCODING": "utf-8",
    }
    log(
        f"Worker {worker}: starting frontend — PORT={front_port}  API_PORT={api_port}  NEXTAUTH_URL=http://localhost:{front_port}"
    )
    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        ["npx", "next", "start", "--port", str(front_port)],
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    prefix = f"[W{worker}|front:{front_port}]"
    threading.Thread(
        target=pipe_output,
        args=(proc.stdout, prefix, True),
        kwargs={"log_file": log_dir / "frontend.log"},
        daemon=True,
    ).start()


def run_cypress(worker: int, specs: list[Path], stats: dict) -> int:
    """Run a Cypress instance for this worker on the given spec files.

    Collects aggregated test counts into `stats` (passed by reference).
    """
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    screenshots_path = f"cypress/results/screenshots/screenshots-{worker}"

    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    cypress_log = log_dir / "cypress.log"

    spec_count = len(specs)
    spec_arg = ",".join(str(s) for s in specs)

    cmd = [
        "xvfb-run",
        "-a",
        "npx",
        "cypress",
        "run",
        "--spec",
        spec_arg,
        "--expose",
        f"backendUrl=http://localhost:{api_port}",
        "--config",
        (f"baseUrl=http://localhost:{front_port},screenshotsFolder={screenshots_path}"),
    ]
    log(f"Worker {worker}: launching Cypress ({spec_count} spec(s))...")

    env = {
        **os.environ,
        "ELECTRON_EXTRA_LAUNCH_ARGS": f"--remote-debugging-port={BASE_CDP_PORT + worker}",
    }
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    prefix = f"[W{worker}|cypress]"

    output_thread = threading.Thread(
        target=pipe_output,
        args=(proc.stdout, prefix),
        kwargs={"log_file": cypress_log},
    )

    output_thread.start()
    worker_start = time.time()
    proc.wait()
    output_thread.join(timeout=5)
    stats.update(parse_cypress_stats(cypress_log))
    stats["duration_seconds"] = round(time.time() - worker_start, 1)
    log(f"Worker {worker}: Cypress finished with exit code {proc.returncode}")

    if proc.returncode != 0:
        log(f"Worker {worker}: full logs → front/cypress/results/workers/worker-{worker}/")

    return proc.returncode


def run_parallel(threads: list[threading.Thread]) -> None:
    for t in threads:
        t.start()
    for t in threads:
        t.join()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel (CI only).")
    parser.add_argument(
        "--spec",
        required=True,
        metavar="LANES",
        help=(
            "One runner's lanes from spec_planner.py: specs comma-separated, lanes "
            "separated by '|'. Each lane gets its own worker."
        ),
    )
    args = parser.parse_args()

    spec_buckets = resolve_spec_lanes(args.spec)
    worker_number = len(spec_buckets)
    start_time = time.time()
    log(f"Starting E2E parallel run with {worker_number} worker(s)...")

    base_env = os.environ.copy()
    base_env.setdefault("NEXTAUTH_SECRET", "e2e-local-nextauth-secret")

    # Each backend waits for MariaDB and creates its own database (app_testing.py).
    start_static_server()
    for worker in range(worker_number):
        start_backend(worker, base_env)
        start_frontend(worker, base_env)

    log("Waiting for all servers to be ready...")
    wait_for_http(localhost_url(STATIC_PORT, "/static/"), "Static assets")
    for worker in range(worker_number):
        wait_for_http(localhost_url(BASE_API_PORT + worker), f"Backend {worker}")
        wait_for_http(
            localhost_url(BASE_FRONT_PORT + worker, "/api/auth/providers"), f"Frontend {worker}"
        )

    log("All servers ready. Launching Cypress workers...")
    for i, lane in enumerate(spec_buckets):
        log(f"Worker {i} lane: {[str(s.relative_to(FRONT_DIR)) for s in lane]}")
    results: list[int] = [0] * worker_number
    worker_stats: list[dict] = [{} for _ in range(worker_number)]

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, spec_buckets[worker], worker_stats[worker])

    run_parallel([threading.Thread(target=cypress_worker, args=(i,)) for i in range(worker_number)])

    # Merge and print combined results
    merged: dict[str, int] = {}
    for stats in worker_stats:
        for key, val in stats.items():
            merged[key] = merged.get(key, 0) + val

    if merged:
        log("-" * 50)
        log("MERGED RESULTS (all workers combined):")
        for key in ["tests", "passing", "failing", "pending", "skipped"]:
            val = merged.get(key, 0)
            log(f"  {key.capitalize():<10}: {val}")
        log("-" * 50)

    elapsed = time.time() - start_time

    # Write failure report (always, even if 0 failures)
    build_merged_report(merged, worker_stats, elapsed)
    minutes, seconds = divmod(int(elapsed), 60)
    duration_str = f"{minutes}m{seconds:02d}s" if minutes else f"{seconds}s"

    exit_code = max(results)
    log(
        f"Done in {duration_str}. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}"
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
