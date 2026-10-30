"""The servers one E2E worker needs: a backend and a frontend per worker, one static server."""

import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    API_DIR,
    BASE_API_PORT,
    BASE_FRONT_PORT,
    DB_PREFIX,
    FRONT_DIR,
    HEALTH_TIMEOUT,
    MARIADB_PORT,
    ROOT,
    STATIC_PORT,
    log,
    worker_log_dir,
)

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mKHFABCDJG]")
# Next build output for E2E, separate from the dev .next. The same value
# is spelled out in .github/workflows/_test.yaml and
# front/tsconfig.json, so renaming it here alone is not enough.
NEXT_E2E_DIST = ".next-e2e"


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


def start_static_server() -> None:
    """Serve static-assets/ locally: otherwise the /static rewrite targets the Docker-only
    `static` host, and every image stalls `next start` on a DNS lookup that never succeeds."""
    log(f"Starting static assets server — PORT={STATIC_PORT}")
    subprocess.Popen(
        [sys.executable, "-m", "http.server", str(STATIC_PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT / "static-assets"),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def start_backend(worker: int) -> None:
    api_port = BASE_API_PORT + worker
    db = get_db_name(worker)
    env = {
        **os.environ,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
        "MARIADB_PORT": str(MARIADB_PORT),
        "PORT": str(api_port),
        "PYTHONIOENCODING": "utf-8",
        # Without this, print() is block-buffered into the log and lost when the
        # process is killed on timeout — including reset_db's "Attempt N failed"
        # lines, which are the only place the real startup error is reported.
        "PYTHONUNBUFFERED": "1",
    }
    log(f"Worker {worker}: starting backend  — PORT={api_port}  DB={db}  MODE=testing")
    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    # Straight to the file, in its own session: the backend outlives the
    # `backends` step that starts it, and a pipe would break when that step exits.
    with (log_dir / "backend.log").open("w", encoding="utf-8") as log_file:
        subprocess.Popen(
            ["uv", "run", "app_testing.py"],
            cwd=str(API_DIR),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )


def start_frontend(worker: int) -> None:
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    env = {
        **os.environ,
        "NEXTAUTH_SECRET": os.environ.get("NEXTAUTH_SECRET", "e2e-local-nextauth-secret"),
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
        ["pnpm", "exec", "next", "start", "--port", str(front_port)],
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


def wait_for_servers(workers: int) -> None:
    log("Waiting for all servers to be ready...")
    wait_for_http(localhost_url(STATIC_PORT, "/static/"), "Static assets")
    for worker in range(workers):
        wait_for_http(localhost_url(BASE_API_PORT + worker), f"Backend {worker}")
        wait_for_http(
            localhost_url(BASE_FRONT_PORT + worker, "/api/auth/providers"), f"Frontend {worker}"
        )
