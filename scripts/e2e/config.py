import os
import sys
from pathlib import Path

# scripts/e2e/config.py -> scripts/e2e -> scripts -> repo root
ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "api"
FRONT_DIR = ROOT / "front"
RESULTS_DIR = FRONT_DIR / "cypress" / "results"

BASE_API_PORT = 8010
BASE_FRONT_PORT = 3010
# Left to Cypress, two workers launched together can draw the same CDP port and drive one browser.
BASE_CDP_PORT = 9310
STATIC_PORT = 8009
DB_PREFIX = "mawster_test_"
MARIADB_PORT = int(os.environ.get("MARIADB_PORT", "3307"))
# Generous on purpose: a backend waits for MariaDB itself (app_testing.py) and
# runs the migrations before it starts listening, so this budget has to cover a
# cold database, not just uvicorn's boot.
HEALTH_TIMEOUT = 60


def worker_log_dir(worker: int) -> Path:
    return RESULTS_DIR / "workers" / f"worker-{worker}"


def log(msg: str) -> None:
    """Logs to stderr: stdout carries the matrix JSON CI pipes into $GITHUB_OUTPUT."""
    print(f"[e2e-parallel] {msg}", flush=True, file=sys.stderr)
