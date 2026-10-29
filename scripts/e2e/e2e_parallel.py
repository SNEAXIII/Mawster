#!/usr/bin/env python3
"""
E2E parallel test runner for Mawster — CI only (.github/workflows/_test.yaml).

Two steps, so the backends boot while CI sets up the frontend:
    python3 scripts/e2e/e2e_parallel.py backends --spec "<lanes from spec_planner.py>"
    python3 scripts/e2e/e2e_parallel.py tests    --spec "<same lanes>"

Each lane N gets its own worker:
  - Backend on port 8010+N  (MariaDB DB: mawster_test_N)
  - Frontend on port 3010+N (next start serving the .next-e2e build from the e2e-build job)
  - Cypress instance running that lane's specs
"""

import argparse
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    BASE_API_PORT,
    BASE_CDP_PORT,
    BASE_FRONT_PORT,
    FRONT_DIR,
    log,
    worker_log_dir,
)
from report import (  # pylint: disable=import-error,wrong-import-position
    build_merged_report,
    merge_stats,
    parse_cypress_stats,
)
from servers import (  # pylint: disable=import-error,wrong-import-position
    pipe_output,
    start_backend,
    start_frontend,
    start_static_server,
    wait_for_servers,
)
from spec_planner import (  # pylint: disable=import-error,wrong-import-position
    resolve_spec_lanes,
)


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

    cmd = [
        "xvfb-run",
        "-a",
        "pnpm",
        "exec",
        "cypress",
        "run",
        "--browser",
        "chrome",
        "--spec",
        ",".join(str(s) for s in specs),
        "--expose",
        f"backendUrl=http://localhost:{api_port}",
        "--config",
        (f"baseUrl=http://localhost:{front_port},screenshotsFolder={screenshots_path}"),
    ]
    log(f"Worker {worker}: launching Cypress ({len(specs)} spec(s))...")

    env = {**os.environ, "CYPRESS_REMOTE_DEBUGGING_PORT": str(BASE_CDP_PORT + worker)}
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output_thread = threading.Thread(
        target=pipe_output,
        args=(proc.stdout, f"[W{worker}|cypress]"),
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


def start_backends(lanes: list[list[Path]]) -> None:
    """Start the static server and one backend per lane, detached, then return.

    Each backend waits for MariaDB and creates its own database (app_testing.py).
    """
    start_static_server()
    for worker in range(len(lanes)):
        start_backend(worker)


def run_tests(lanes: list[list[Path]]) -> int:
    """Start the frontends, wait for every server, run one Cypress per lane, write the report."""
    workers = len(lanes)
    start_time = time.time()
    for worker in range(workers):
        start_frontend(worker)
    wait_for_servers(workers)

    log("All servers ready. Launching Cypress workers...")
    for i, lane in enumerate(lanes):
        log(f"Worker {i} lane: {[str(s.relative_to(FRONT_DIR)) for s in lane]}")
    results: list[int] = [0] * workers
    worker_stats: list[dict] = [{} for _ in range(workers)]

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, lanes[worker], worker_stats[worker])

    threads = [threading.Thread(target=cypress_worker, args=(i,)) for i in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    elapsed = time.time() - start_time
    # Written even with 0 failures.
    build_merged_report(merge_stats(worker_stats), worker_stats, elapsed)
    minutes, seconds = divmod(int(elapsed), 60)
    duration_str = f"{minutes}m{seconds:02d}s" if minutes else f"{seconds}s"

    exit_code = max(results)
    log(
        f"Done in {duration_str}. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}"
    )
    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel (CI only).")
    parser.add_argument("step", choices=("backends", "tests"))
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

    lanes = resolve_spec_lanes(args.spec)
    log(f"{args.step}: {len(lanes)} worker(s)")
    if args.step == "backends":
        start_backends(lanes)
    else:
        sys.exit(run_tests(lanes))


if __name__ == "__main__":
    main()
