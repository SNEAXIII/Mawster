import os
import sys
from pathlib import Path

# scripts/e2e/config.py -> scripts/e2e -> scripts -> repo root
ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "api"
FRONT_DIR = ROOT / "front"

BASE_API_PORT = 8010
BASE_FRONT_PORT = 3010
DB_PREFIX = "mawster_test_"
MARIADB_HOST = "127.0.0.1"
MARIADB_PORT = int(os.environ.get("MARIADB_PORT", "3307"))
MARIADB_ROOT_PASSWORD = os.environ.get("MARIADB_ROOT_PASSWORD", "rootpassword")  # NOSONAR
MARIADB_CONTAINER = os.environ.get("MARIADB_CONTAINER", "mariadb-test")
# Generous on purpose: a backend now waits for MariaDB itself (up to 25s in
# app_testing.py) and runs the migrations before it starts listening, so this
# budget has to cover a cold database, not just uvicorn's boot.
HEALTH_TIMEOUT = 60


def log(msg: str) -> None:
    """Logs to stderr: stdout carries the matrix JSON CI pipes into $GITHUB_OUTPUT."""
    print(f"[e2e-parallel] {msg}", flush=True, file=sys.stderr)
