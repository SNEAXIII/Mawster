#!/usr/bin/env python3
"""
E2E parallel test runner for Mawster.

Usage:
    python scripts/e2e_parallel.py --workers 4

Each worker N gets:
  - Backend on port 8010+N  (MariaDB DB: mawster_test_N)
  - Frontend on port 3010+N (Next.js distDir: .next-3010+N)
  - Cypress instance with split=total,splitIndex=N
"""

import argparse
import atexit
import os
import platform
import subprocess
import sys
import threading
import time
from pathlib import Path

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
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mysql", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
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
    """CREATE DATABASE IF NOT EXISTS mawster_test_N via docker exec."""
    db = f"{DB_PREFIX}{worker}"
    log(f"Worker {worker}: creating database {db}...")
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mysql", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
            "-e", f"CREATE DATABASE IF NOT EXISTS `{db}`;",
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


def start_backend(worker: int, base_env: dict) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    db = f"{DB_PREFIX}{worker}"
    env = {
        **base_env,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
        "PORT": str(api_port),
    }
    log(f"Worker {worker}: starting backend on port {api_port} (DB: {db})...")
    return subprocess.Popen(
        ["uv", "run", "app_testing.py"],
        cwd=str(API_DIR),
        env=env,
    )


def start_frontend(worker: int, base_env: dict) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    env = {
        **base_env,
        "PORT": str(front_port),
        "API_PORT": str(api_port),
        "NEXTAUTH_URL": f"http://localhost:{front_port}",
    }
    log(f"Worker {worker}: starting frontend on port {front_port} (API: {api_port})...")
    return subprocess.Popen(
        [NPM, "run", "dev"],
        cwd=str(FRONT_DIR),
        env=env,
    )


def run_cypress(worker: int, total: int) -> int:
    """Run a Cypress instance for this worker, return exit code."""
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    log(f"Worker {worker}: launching Cypress (splitIndex={worker}/{total})...")
    result = subprocess.run(
        [
            NPX, "cypress", "run",
            "--env", f"backendUrl=http://localhost:{api_port},split={total},splitIndex={worker}",
            "--config", f"baseUrl=http://localhost:{front_port}",
        ],
        cwd=str(FRONT_DIR),
    )
    log(f"Worker {worker}: Cypress finished with exit code {result.returncode}")
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel.")
    parser.add_argument(
        "--workers", type=int, default=2,
        metavar="N", choices=range(1, 9),
        help="Number of parallel workers (1-8, default: 2)",
    )
    args = parser.parse_args()
    n = args.workers

    log(f"Starting E2E parallel run with {n} worker(s)...")
    check_mariadb_running()

    base_env = os.environ.copy()
    procs: list[subprocess.Popen] = []
    lock = threading.Lock()

    def cleanup() -> None:
        log("Shutting down all servers...")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass

    atexit.register(cleanup)

    # Phase 1: create DBs and start servers in parallel
    errors: list[str] = []

    def setup_worker(worker: int) -> None:
        try:
            docker_create_db(worker)
            backend = start_backend(worker, base_env)
            frontend = start_frontend(worker, base_env)
            with lock:
                procs.extend([backend, frontend])
        except Exception as exc:
            with lock:
                errors.append(f"Worker {worker}: {exc}")

    threads = [threading.Thread(target=setup_worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

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
                f"http://localhost:{BASE_API_PORT + worker}/docs",
                f"Backend {worker}",
            )
            wait_for_http(
                f"http://localhost:{BASE_FRONT_PORT + worker}",
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
    results: list[int] = [0] * n

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, n)

    cypress_threads = [threading.Thread(target=cypress_worker, args=(i,)) for i in range(n)]
    for t in cypress_threads:
        t.start()
    for t in cypress_threads:
        t.join()

    exit_code = max(results)
    log(f"Done. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
