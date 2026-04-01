#!/usr/bin/env python3
"""
E2E parallel test runner for Mawster.

Usage:
    python scripts/e2e_parallel.py --workers 4

Each worker N gets:
  - Backend on port 8010+N  (MariaDB DB: mawster_test_N)
  - Frontend on port 3010+N (next start serving shared .next-e2e build)
  - Cypress instance with split=total,splitIndex=N
"""

import urllib.request
import urllib.error
import shutil
import json
import socket
import argparse
import atexit
import os
import platform as _platform
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from dataclasses import dataclass, asdict

# Force UTF-8 stdout on Windows to handle Cypress box-drawing characters (┌─┐│)
# Without this, print() raises UnicodeEncodeError on cp1252 systems, killing pipe_output.
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))
from config import (  # noqa: E402  # pylint: disable=import-error,wrong-import-position
    ROOT,
    API_DIR,
    FRONT_DIR,
    BASE_API_PORT,
    BASE_FRONT_PORT,
    DB_PREFIX,
    MARIADB_HOST,
    MARIADB_PORT,
    MARIADB_ROOT_PASSWORD,
    MARIADB_CONTAINER,
    HEALTH_TIMEOUT,
)
from linux_model import LinuxModel, LinuxHeadlessModel  # noqa: E402  # pylint: disable=import-error,wrong-import-position
from windows_model import WindowsModel  # noqa: E402  # pylint: disable=import-error,wrong-import-position
from IOsModel import IOsModel  # noqa: E402  # pylint: disable=import-error,wrong-import-position

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


def _get_os_model() -> "IOsModel":
    if _platform.system() == "Windows":
        return WindowsModel()
    if os.environ.get("CI") == "true":
        return LinuxHeadlessModel()
    return LinuxModel()


OS = _get_os_model()
NPM = OS.npm
NPX = OS.npx
ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mKHFABCDJG]")


def worker_log_dir(worker: int) -> Path:
    return FRONT_DIR / "cypress" / "results" / "workers" / f"worker-{worker}"


def log(msg: str) -> None:
    print(f"[e2e-parallel] {msg}", flush=True)


def _run_sql(sql: str) -> subprocess.CompletedProcess:
    """Execute SQL against MariaDB.

    Tries 'mariadb' CLI first (works in CI via TCP on MARIADB_PORT).
    Falls back to 'docker exec' if the binary is not found (local dev).
    """
    root_args = ["-uroot", f"-p{MARIADB_ROOT_PASSWORD}", "-e", sql]
    try:
        return subprocess.run(
            ["mariadb", "-h", MARIADB_HOST, "-P", str(MARIADB_PORT)] + root_args,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        container = MARIADB_CONTAINER
        return subprocess.run(
            ["docker", "exec", container, "mariadb"] + root_args,
            capture_output=True,
            text=True,
        )


def check_mariadb_running() -> None:
    """Verify MariaDB is reachable on MARIADB_HOST:MARIADB_PORT."""
    log(f"Checking if MariaDB is reachable on {MARIADB_HOST}:{MARIADB_PORT}...")
    try:
        with socket.create_connection((MARIADB_HOST, MARIADB_PORT), timeout=5):
            pass
        log("MariaDB is reachable.")
    except OSError:
        log(f"ERROR: MariaDB is not reachable on {MARIADB_HOST}:{MARIADB_PORT}.")
        log("Start it with: make e2e-db")
        sys.exit(1)


def create_db(worker: int) -> None:
    """CREATE DATABASE IF NOT EXISTS mawster_test_N and GRANT privileges."""
    db = f"{DB_PREFIX}{worker}"
    db_user = os.environ.get("MARIADB_USER", "user")
    log(f"Worker {worker}: creating database {db}...")
    sql = (
        f"CREATE DATABASE IF NOT EXISTS `{db}`;"
        f" GRANT ALL PRIVILEGES ON `{db}`.* TO '{db_user}'@'%';"
        f" FLUSH PRIVILEGES;"
    )
    result = _run_sql(sql)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create DB {db}: {result.stderr}")
    log(f"Worker {worker}: database {db} created.")


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
    raise TimeoutError(f"{label} at {url} did not become ready within {timeout}s")


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
        if "===TEST_START===" in line:
            idx = line.index("===TEST_START===") + len("===TEST_START===")
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

    out = FRONT_DIR / "cypress" / "results" / "report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Report written → {out.relative_to(ROOT)}  ({len(all_failures)} failure(s))")


def _parse_int(s: str) -> int:
    return int(s) if s != "-" else 0


def pipe_output(
    stream,
    prefix: str,
    quiet: bool = False,
    log_file: "Path | None" = None,
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


def start_backend(worker: int, base_env: dict, quiet: bool = False) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    db = f"{DB_PREFIX}{worker}"
    env = {
        **base_env,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
        "MARIADB_PORT": str(MARIADB_PORT),
        "PORT": str(api_port),
        "PYTHONIOENCODING": "utf-8",
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
        start_new_session=OS.start_new_session,
    )
    prefix = f"[W{worker}|api:{api_port}]"
    threading.Thread(
        target=pipe_output,
        args=(proc.stdout, prefix, quiet),
        kwargs={"log_file": log_dir / "backend.log"},
        daemon=True,
    ).start()
    return proc


def build_frontend(base_env: dict) -> None:
    """Run a single `next build` before launching workers.

    The build uses NEXT_PUBLIC_DEV_MODE=true so the dev user-picker is
    included in the bundle.  All workers then share this output via
    NEXT_DIST_DIR=.next-e2e.
    """
    log("Building frontend (single shared build)...")
    env = {
        **base_env,
        "PORT": "3000",
        "API_PORT": str(
            BASE_API_PORT
        ),  # placeholder — rewrites are runtime-read anyway
        "API_SERVER_HOST": "localhost",
        "NEXT_PUBLIC_DEV_MODE": "true",
        "NEXT_DIST_DIR": ".next-e2e",
        "NEXT_E2E_BUILD": "true",
        "PYTHONIOENCODING": "utf-8",
    }
    result = subprocess.run(
        [NPX, "next", "build"],
        cwd=str(FRONT_DIR),
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError("next build failed")
    log("Frontend build complete.")


def start_frontend(
    worker: int, base_env: dict, quiet: bool = False
) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    env = {
        **base_env,
        "PORT": str(front_port),
        "API_PORT": str(api_port),
        "API_SERVER_HOST": "localhost",
        "NEXTAUTH_URL": f"http://localhost:{front_port}",
        "WORKER_ID": str(worker),
        "NEXT_DIST_DIR": ".next-e2e",
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
        [NPX, "next", "start", "--port", str(front_port)],
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=OS.start_new_session,
    )
    prefix = f"[W{worker}|front:{front_port}]"
    threading.Thread(
        target=pipe_output,
        args=(proc.stdout, prefix, quiet),
        kwargs={"log_file": log_dir / "frontend.log"},
        daemon=True,
    ).start()
    return proc


def get_spec_files() -> list[Path]:
    """Return all Cypress spec files sorted by path."""
    return sorted((FRONT_DIR / "cypress" / "e2e").rglob("*.cy.ts"))


def count_tests(spec: Path) -> int:
    """Estimate test weight by counting it( calls in the spec file."""
    try:
        return max(1, spec.read_text(encoding="utf-8").count("  it("))
    except Exception:
        return 1


def distribute_specs(specs: list[Path], n: int) -> list[list[Path]]:
    """Greedy bin-packing: assign heaviest specs first to the lightest bucket."""
    weighted = sorted(
        ((s, count_tests(s)) for s in specs), key=lambda x: x[1], reverse=True
    )
    buckets: list[list[Path]] = [[] for _ in range(n)]
    totals = [0] * n
    for spec, w in weighted:
        i = min(range(n), key=lambda i: totals[i])
        buckets[i].append(spec)
        totals[i] += w
    log(f"Spec distribution (estimated tests per worker): {totals}")
    return buckets


def run_cypress(worker: int, specs: list[Path], stats: dict) -> int:
    """Run a Cypress instance for this worker on the given spec files.

    Collects aggregated test counts into `stats` (passed by reference).
    """
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    screenshots_path = f"cypress/results/screenshots/screenshots-{worker}"
    videos_path = f"cypress/results/videos/videos-{worker}"

    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    cypress_log = log_dir / "cypress.log"

    spec_count = len(specs)
    spec_arg = ",".join(str(s) for s in specs)

    cmd = [
        NPX,
        "cypress",
        "run",
        "--spec",
        spec_arg,
        "--env",
        f"backendUrl=http://localhost:{api_port}",
        "--config",
        (
            f"baseUrl=http://localhost:{front_port},"
            f"screenshotsFolder={screenshots_path},"
            f"videosFolder={videos_path}"
        ),
    ]
    log(f"Worker {worker}: launching Cypress ({spec_count} spec(s))...")

    cmd = OS.cypress_cmd(cmd)
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONT_DIR),
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
        log(
            f"Worker {worker}: full logs → front/cypress/results/workers/worker-{worker}/"
        )

    return proc.returncode


def run_parallel(threads: list[threading.Thread]) -> None:
    for t in threads:
        t.start()
    for t in threads:
        t.join()


def kill_ports(ports: list[int]) -> None:
    """Kill any process currently listening on the given ports (parallel)."""
    kill_threads = [threading.Thread(target=OS.kill_port, args=(p,)) for p in ports]
    run_parallel(kill_threads)


def resolve_spec_paths(raw_specs: str) -> set[Path]:
    resolved_specs: set[Path] = set()
    for raw in [s.strip() for s in raw_specs.split(",") if s.strip()]:
        spec_path = Path(raw)
        if not spec_path.is_absolute():
            candidate = FRONT_DIR / "cypress" / "e2e" / raw
            if not candidate.exists():
                candidate = FRONT_DIR / raw
            spec_path = candidate
        if not spec_path.exists():
            available = sorted(
                p.relative_to(FRONT_DIR / "cypress" / "e2e")
                for p in (FRONT_DIR / "cypress" / "e2e").rglob("*.cy.ts")
            )
            log(f"ERROR: spec not found: {raw}")
            log("Available specs:")
            for s in available:
                log(f"  {s}")
            sys.exit(1)
        resolved_specs.add(spec_path)
    return resolved_specs


def kill_probably_used_ports(worker_number: int) -> None:
    ports_to_free = [
        *[BASE_API_PORT + i for i in range(worker_number)],
        *[BASE_FRONT_PORT + i for i in range(worker_number)],
    ]
    log(f"Freeing ports: {ports_to_free}")
    kill_ports(ports_to_free)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel.")
    parser.add_argument(
        "--workers",
        type=int,
        default=2,
        metavar="N",
        choices=range(1, 9),
        help="Number of parallel workers (1-8, default: 2)",
    )
    parser.add_argument(
        "--spec",
        type=str,
        default=None,
        metavar="PATTERN",
        help="Run a single spec file (relative to front/cypress/e2e/ or absolute glob). Forces --workers 1.",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Hide backend and frontend logs (Cypress output still shown)",
    )
    args = parser.parse_args()
    quiet = args.quiet

    resolved_specs: set[Path] = set()
    worker_number = args.workers
    if args.spec:
        resolved_specs = set(resolve_spec_paths(args.spec))
        log(
            f"--spec provided: {len(resolved_specs)} spec(s), using {worker_number} worker(s)"
        )
    worker_number = (
        min(worker_number, len(resolved_specs)) if resolved_specs else args.workers
    )

    start_time = time.time()
    log(f"Starting E2E parallel run with {worker_number} worker(s)...")

    kill_probably_used_ports(worker_number)

    check_mariadb_running()

    base_env = os.environ.copy()
    base_env.setdefault("NEXTAUTH_SECRET", "e2e-local-nextauth-secret")
    procs: list[subprocess.Popen] = []
    lock = threading.Lock()

    def cleanup() -> None:
        log("Shutting down all servers...")
        for p in procs:
            try:
                OS.terminate_proc(p)
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    OS.kill_proc(p)
                except Exception:
                    pass
        # Remove the shared e2e build dir
        next_dir = FRONT_DIR / ".next-e2e"
        if next_dir.exists():
            shutil.rmtree(next_dir, ignore_errors=True)
            log(f"Removed {next_dir.name}")

    atexit.register(cleanup)

    def handle_sigint(sig, frame) -> None:
        log("Interrupted — cleaning up...")
        cleanup()
        sys.exit(1)

    signal.signal(signal.SIGINT, handle_sigint)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_sigint)

    # Phase 0+1 in parallel:
    #   - build the frontend once (shared across all workers)
    #   - create DBs and start backends (don't need the build)
    # Frontends start after the build completes.
    errors: list[str] = []
    build_event = threading.Event()
    build_error: list[str] = []

    def run_build() -> None:
        try:
            build_frontend(base_env)
            build_event.set()
        except RuntimeError as exc:
            build_error.append(str(exc))
            build_event.set()  # unblock waiting workers

    def setup_worker(worker: int) -> None:
        try:
            create_db(worker)
            backend = start_backend(worker, base_env, quiet)
            with lock:
                procs.append(backend)
            # Wait for the build before launching `next start`
            build_event.wait()
            if build_error:
                return
            frontend = start_frontend(worker, base_env, quiet)
            with lock:
                procs.append(frontend)
        except Exception as exc:
            with lock:
                errors.append(f"Worker {worker}: {exc}")

    all_threads = [
        threading.Thread(target=setup_worker, args=(i,)) for i in range(worker_number)
    ]
    all_threads.append(threading.Thread(target=run_build))
    run_parallel(all_threads)

    if build_error:
        log(f"ERROR: {build_error[0]}")
        sys.exit(1)
    if errors:
        for err in errors:
            log(f"ERROR: {err}")
        sys.exit(1)

    # Phase 2: health checks in parallel
    log("Waiting for all servers to be ready...")
    health_errors: list[str] = []

    def health_check_worker(worker: int) -> None:
        try:
            wait_for_http(
                f"http://localhost:{BASE_API_PORT + worker}",
                f"Backend {worker}",
            )
            wait_for_http(
                f"http://localhost:{BASE_FRONT_PORT + worker}/api/auth/providers",
                f"Frontend {worker}",
            )
        except TimeoutError as exc:
            with lock:
                health_errors.append(str(exc))

    health_threads = [
        threading.Thread(target=health_check_worker, args=(i,))
        for i in range(worker_number)
    ]
    run_parallel(health_threads)

    if health_errors:
        for err in health_errors:
            log(f"ERROR: {err}")
        sys.exit(1)

    # Phase 3: run Cypress workers in parallel
    log("All servers ready. Launching Cypress workers...")
    if resolved_specs:
        specs = resolved_specs
        log(
            f"Running {len(specs)} spec(s): {[str(s.relative_to(FRONT_DIR)) for s in specs]}"
        )
    else:
        specs = get_spec_files()
        log(
            f"Found {len(specs)} spec file(s) to distribute across {worker_number} worker(s)."
        )
    spec_buckets = distribute_specs(specs, worker_number)
    results: list[int] = [0] * worker_number
    worker_stats: list[dict] = [{} for _ in range(worker_number)]

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(
            worker, spec_buckets[worker], worker_stats[worker]
        )

    cypress_threads = [
        threading.Thread(target=cypress_worker, args=(i,)) for i in range(worker_number)
    ]
    run_parallel(cypress_threads)

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
