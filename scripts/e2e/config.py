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

# Vision mode (--vision): dev credentials, as in compose-dev.yaml and api/src/security/secrets.py.
RABBITMQ_PORT = 5672
RABBITMQ_URL = "amqp://mawster:mawster@localhost:5672/%2f"
RUSTFS_PORT = 9000
RUSTFS_URL = f"http://localhost:{RUSTFS_PORT}"
RUSTFS_ACCESS_KEY = "mawster"
RUSTFS_SECRET_KEY = "mawsterpassword"  # noqa: S105
VISION_MODELS_DIR = ROOT / "rust-vision" / "artifacts-vision" / "artifacts"
# Cold RabbitMQ and RustFS images can take minutes to pull and boot.
VISION_STARTUP_TIMEOUT = 180
VISION_PID_FILE = "vision-worker.pid"


def worker_log_dir(worker: int) -> Path:
    return RESULTS_DIR / "workers" / f"worker-{worker}"


def log(msg: str) -> None:
    """Logs to stderr: stdout carries the matrix JSON CI pipes into $GITHUB_OUTPUT."""
    print(f"[e2e-parallel] {msg}", flush=True, file=sys.stderr)
