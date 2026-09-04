import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
API_DIR = ROOT / "api"
FRONT_DIR = ROOT / "front"

BASE_API_PORT = 8010
BASE_FRONT_PORT = 3010
DB_PREFIX = "mawster_test_"
MARIADB_HOST = "127.0.0.1"
MARIADB_PORT = int(os.environ.get("MARIADB_PORT", "3307"))
MARIADB_ROOT_PASSWORD = os.environ.get("MARIADB_ROOT_PASSWORD", "rootpassword")  # NOSONAR
MARIADB_CONTAINER = os.environ.get("MARIADB_CONTAINER", "mariadb-test")
HEALTH_TIMEOUT = 20


def log(msg: str) -> None:
    """Progress line for the E2E tooling.

    Goes to stderr so that `--plan` can pipe clean JSON on stdout into
    $GITHUB_OUTPUT while the distribution recap stays readable in the log.
    """
    print(f"[e2e-parallel] {msg}", flush=True, file=sys.stderr)
