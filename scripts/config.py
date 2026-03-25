import os
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
