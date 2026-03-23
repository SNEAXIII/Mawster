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

import argparse
import atexit
import os
import platform
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# Matches the final summary line printed by Cypress after all specs:
#   "  √  All specs passed!                        01:39   60   54    -    6    -"
#   "  ×  1 of 6 failed (17%)                      01:16   55   54    1    -    -"
# Groups: tests, passing, failing, pending, skipped  ("-" means 0)
FINAL_SUMMARY_RE = re.compile(
    r"(?:passed!|failed.*?)"  # "passed!" or "failed" + optional suffix like " (17%)"
    r"\s+[\d:]+\s+"           # duration (e.g. 01:16)
    r"(\d+|-)\s+"             # tests
    r"(\d+|-)\s+"             # passing
    r"(\d+|-)\s+"             # failing
    r"(\d+|-)\s+"             # pending
    r"(\d+|-)"                # skipped
)

ROOT = Path(__file__).parent.parent
API_DIR = ROOT / "api"
FRONT_DIR = ROOT / "front"

BASE_API_PORT = 8010
BASE_FRONT_PORT = 3010
DB_PREFIX = "mawster_test_"
MARIADB_CONTAINER = "mariadb-test"
MARIADB_ROOT_PASSWORD = "rootpassword"
HEALTH_TIMEOUT = 120

IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"
NPX = "npx.cmd" if IS_WINDOWS else "npx"


def log(msg: str) -> None:
    print(f"[e2e-parallel] {msg}", flush=True)


def check_mariadb_running() -> None:
    """Verify the mariadb-test container is up."""
    log("Checking if mariadb-test container is running...")
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mariadb", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
            "-e", "SELECT 1;",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log("ERROR: mariadb-test container is not running.")
        log("Start it with: make e2e-db")
        sys.exit(1)


def docker_create_db(worker: int) -> None:
    """CREATE DATABASE IF NOT EXISTS mawster_test_N and GRANT privileges via docker exec."""
    db = f"{DB_PREFIX}{worker}"
    db_user = os.environ.get("MARIADB_USER", "user")
    log(f"Worker {worker}: creating database {db}...")
    sql = (
        f"CREATE DATABASE IF NOT EXISTS `{db}`;"
        f" GRANT ALL PRIVILEGES ON `{db}`.* TO '{db_user}'@'%';"
        f" FLUSH PRIVILEGES;"
    )
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mariadb", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
            "-e", sql,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create DB {db}: {result.stderr}")
    log(f"Worker {worker}: database {db} created.")


def wait_for_http(url: str, label: str, timeout: int = HEALTH_TIMEOUT) -> None:
    """Poll url until HTTP response received (any status code = server is up)."""
    import urllib.request
    import urllib.error

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
    n: int,
    merged_stats: dict,
) -> None:
    """Build and write front/cypress/results/report.json.

    Reads per-worker cypress.log and backend.log, correlates failures with
    backend log lines captured between ===TEST_START=== / ===TEST_END=== markers.
    """
    import json

    all_failures: list[dict] = []

    for worker in range(n):
        log_dir = worker_log_dir(worker)
        cypress_log = log_dir / "cypress.log"
        backend_log = log_dir / "backend.log"

        cypress_failures = parse_cypress_failures(cypress_log)
        backend_markers = parse_backend_markers(backend_log)

        for failure in cypress_failures:
            title = failure["title"]
            backend_logs = backend_markers.get(title, [])
            if not backend_logs:
                # Fuzzy fallback: find any marker key that ends with / contains the title
                for key, val in backend_markers.items():
                    if title.endswith(key) or key.endswith(title):
                        backend_logs = val
                        break

            all_failures.append({
                "title": title,
                "worker": worker,
                "cypress_error": failure["error"],
                "backend_logs": backend_logs,
            })

    report = {
        "summary": {
            "tests": merged_stats.get("tests", 0),
            "passing": merged_stats.get("passing", 0),
            "failing": merged_stats.get("failing", 0),
        },
        "failures": all_failures,
    }

    out = FRONT_DIR / "cypress" / "results" / "report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Report written → {out.relative_to(ROOT)}  ({len(all_failures)} failure(s))")


def worker_log_dir(worker: int) -> Path:
    return FRONT_DIR / "cypress" / "results" / "workers" / f"worker-{worker}"


def pipe_output(stream, prefix: str, quiet: bool = False, stats: dict | None = None, log_file: "Path | None" = None) -> None:
    """Read lines from a subprocess stream and print them with a worker prefix.

    If `stats` is provided, accumulate numeric results from the Cypress
    'Results:' summary block (Tests / Passing / Failing / Pending / Skipped).
    If `log_file` is provided, all lines are written to that file.
    """
    try:
        fh = log_file.open("w", encoding="utf-8") if log_file else None
        try:
            for line in iter(stream.readline, b""):
                decoded = line.decode(errors="replace").rstrip()
                if not quiet:
                    print(f"{prefix} {decoded}")
                if fh:
                    fh.write(decoded + "\n")
                if stats is not None:
                    m = FINAL_SUMMARY_RE.search(decoded)
                    if m:
                        def _n(s: str) -> int:
                            return int(s) if s != "-" else 0
                        stats["tests"] = _n(m.group(1))
                        stats["passing"] = _n(m.group(2))
                        stats["failing"] = _n(m.group(3))
                        stats["pending"] = _n(m.group(4))
                        stats["skipped"] = _n(m.group(5))
        finally:
            if fh:
                fh.close()
    except Exception:
        pass


def start_backend(worker: int, base_env: dict, quiet: bool = False) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    db = f"{DB_PREFIX}{worker}"
    env = {
        **base_env,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
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
        start_new_session=not IS_WINDOWS,
    )
    prefix = f"[W{worker}|api:{api_port}]"
    threading.Thread(target=pipe_output, args=(proc.stdout, prefix, quiet), kwargs={"log_file": log_dir / "backend.log"}, daemon=True).start()
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
        "API_PORT": str(BASE_API_PORT),   # placeholder — rewrites are runtime-read anyway
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


def start_frontend(worker: int, base_env: dict, quiet: bool = False) -> subprocess.Popen:
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
    log(f"Worker {worker}: starting frontend — PORT={front_port}  API_PORT={api_port}  NEXTAUTH_URL=http://localhost:{front_port}")
    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [NPX, "next", "start", "--port", str(front_port)],
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=not IS_WINDOWS,
    )
    prefix = f"[W{worker}|front:{front_port}]"
    threading.Thread(target=pipe_output, args=(proc.stdout, prefix, quiet), kwargs={"log_file": log_dir / "frontend.log"}, daemon=True).start()
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
    weighted = sorted(((s, count_tests(s)) for s in specs), key=lambda x: x[1], reverse=True)
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

    cmd = [
        NPX, "cypress", "run",
        "--spec", ",".join(str(s) for s in specs),
        "--env", f"backendUrl=http://localhost:{api_port}",
        "--config", (
            f"baseUrl=http://localhost:{front_port},"
            f"screenshotsFolder=cypress/results/screenshots/screenshots-{worker},"
            f"videosFolder=cypress/results/videos/videos-{worker}"
        ),
    ]
    log(f"Worker {worker}: launching Cypress ({len(specs)} spec(s))...")

    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    cypress_log = log_dir / "cypress.log"
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    prefix = f"[W{worker}|cypress]"
    output_thread = threading.Thread(target=pipe_output, args=(proc.stdout, prefix, False, stats), kwargs={"log_file": cypress_log})
    output_thread.start()
    proc.wait()
    output_thread.join(timeout=5)
    log(f"Worker {worker}: Cypress finished with exit code {proc.returncode}")

    if proc.returncode != 0:
        log(f"Worker {worker}: full logs → front/cypress/results/workers/worker-{worker}/")

    return proc.returncode


def kill_ports(ports: list[int]) -> None:
    """Kill any process currently listening on the given ports (parallel)."""
    port_set = set(ports)

    if IS_WINDOWS:
        # Single netstat call, then taskkill in parallel
        result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        # Map port -> set of PIDs
        victims: dict[int, set[str]] = {p: set() for p in port_set}
        for line in result.stdout.splitlines():
            if "LISTENING" not in line:
                continue
            for port in port_set:
                if f":{port} " in line:
                    parts = line.split()
                    victims[port].add(parts[-1])

        def _kill_pid(pid: str, port: int) -> None:
            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
            log(f"Killed PID {pid} on port {port}")

        kill_threads = [
            threading.Thread(target=_kill_pid, args=(pid, port))
            for port, pids in victims.items()
            for pid in pids
        ]
        for t in kill_threads:
            t.start()
        for t in kill_threads:
            t.join()
    else:
        def _kill_port(port: int) -> None:
            # fuser -k kills all processes on the port (IPv4 + IPv6)
            result = subprocess.run(
                ["fuser", "-k", "-KILL", f"{port}/tcp"],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                # fuser not available or no process found — fallback to lsof
                result = subprocess.run(
                    ["lsof", "-ti", f":{port}"],
                    capture_output=True, text=True,
                )
                for pid in result.stdout.strip().splitlines():
                    subprocess.run(["kill", "-9", pid.strip()], capture_output=True)
                    log(f"Killed PID {pid} on port {port}")

        kill_threads = [threading.Thread(target=_kill_port, args=(p,)) for p in port_set]
        for t in kill_threads:
            t.start()
        for t in kill_threads:
            t.join()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel.")
    parser.add_argument(
        "--workers", type=int, default=2,
        metavar="N", choices=range(1, 9),
        help="Number of parallel workers (1-8, default: 2)",
    )
    parser.add_argument(
        "--spec", type=str, default=None,
        metavar="PATTERN",
        help="Run a single spec file (relative to front/cypress/e2e/ or absolute glob). Forces --workers 1.",
    )
    parser.add_argument(
        "--quiet", "-q", action="store_true",
        help="Hide backend and frontend logs (Cypress output still shown)",
    )
    args = parser.parse_args()
    quiet = args.quiet

    if args.spec:
        n = 1
        log(f"--spec provided: forcing 1 worker for '{args.spec}'")
    else:
        n = args.workers

    start_time = time.time()
    log(f"Starting E2E parallel run with {n} worker(s)...")

    ports_to_free = [
        *[BASE_API_PORT + i for i in range(n)],
        *[BASE_FRONT_PORT + i for i in range(n)],
    ]
    log(f"Freeing ports: {ports_to_free}")
    kill_ports(ports_to_free)

    check_mariadb_running()

    base_env = os.environ.copy()
    base_env.setdefault("NEXTAUTH_SECRET", "e2e-local-nextauth-secret")
    procs: list[subprocess.Popen] = []
    lock = threading.Lock()

    def cleanup() -> None:
        log("Shutting down all servers...")
        for p in procs:
            try:
                if IS_WINDOWS:
                    p.terminate()
                else:
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                try:
                    p.terminate()
                except Exception:
                    pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:
                try:
                    if IS_WINDOWS:
                        p.kill()
                    else:
                        os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except Exception:
                    try:
                        p.kill()
                    except Exception:
                        pass
        # Remove the shared e2e build dir
        import shutil
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
            docker_create_db(worker)
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

    all_threads = [threading.Thread(target=run_build)] + [
        threading.Thread(target=setup_worker, args=(i,)) for i in range(n)
    ]
    for t in all_threads:
        t.start()
    for t in all_threads:
        t.join()

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

    health_threads = [threading.Thread(target=health_check_worker, args=(i,)) for i in range(n)]
    for t in health_threads:
        t.start()
    for t in health_threads:
        t.join()

    if health_errors:
        for err in health_errors:
            log(f"ERROR: {err}")
        sys.exit(1)

    # Phase 3: run Cypress workers in parallel
    log("All servers ready. Launching Cypress workers...")
    if args.spec:
        # Resolve the spec path relative to front/cypress/e2e/ if not absolute
        spec_path = Path(args.spec)
        if not spec_path.is_absolute():
            candidate = FRONT_DIR / "cypress" / "e2e" / args.spec
            if not candidate.exists():
                candidate = FRONT_DIR / args.spec
            spec_path = candidate
        if not spec_path.exists():
            log(f"ERROR: spec not found: {spec_path}")
            sys.exit(1)
        specs = [spec_path]
        log(f"Running single spec: {spec_path.relative_to(FRONT_DIR)}")
    else:
        specs = get_spec_files()
        log(f"Found {len(specs)} spec file(s) to distribute across {n} worker(s).")
    spec_buckets = distribute_specs(specs, n)
    results: list[int] = [0] * n
    worker_stats: list[dict] = [{} for _ in range(n)]

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, spec_buckets[worker], worker_stats[worker])

    cypress_threads = [threading.Thread(target=cypress_worker, args=(i,)) for i in range(n)]
    for t in cypress_threads:
        t.start()
    for t in cypress_threads:
        t.join()

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

    # Write failure report (always, even if 0 failures)
    build_merged_report(n, merged)

    elapsed = time.time() - start_time
    minutes, seconds = divmod(int(elapsed), 60)
    duration_str = f"{minutes}m{seconds:02d}s" if minutes else f"{seconds}s"

    exit_code = max(results)
    log(f"Done in {duration_str}. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
