import os

os.environ["MODE"] = "testing"

import time

import pymysql
import uvicorn

from src.fixtures.reset_db import reset
from src.security.secrets import SECRET

# The E2E MariaDB has no readiness gate in front of it: the CI service container
# declares no --health-cmd, so the job starts while the server is still booting,
# and the runner no longer probes it either. Waiting is this script's job, with
# the budget the removed --health-interval/--health-retries options used to hold.
MARIADB_PROBE_INTERVAL = 2
MARIADB_PROBE_TIMEOUT = 25


def _root_connect() -> pymysql.Connection:
    """Connect as root with no database selected — the schema may not exist yet."""
    return pymysql.connect(
        host=SECRET.MARIADB_HOST,
        port=SECRET.MARIADB_PORT,
        user="root",
        password=SECRET.MARIADB_ROOT_PASSWORD or "",
    )


def _wait_for_mariadb() -> None:
    """Poll MariaDB until it answers a real query.

    A TCP connect is not enough: Docker publishes the host port through
    docker-proxy, which accepts connections before mysqld listens behind it.
    """
    target = f"{SECRET.MARIADB_HOST}:{SECRET.MARIADB_PORT}"
    deadline = time.monotonic() + MARIADB_PROBE_TIMEOUT
    print(f"🚀 Waiting for MariaDB at {target}")
    while True:
        try:
            with _root_connect() as conn, conn.cursor() as cursor:
                cursor.execute("SELECT 1")
            print("✅ MariaDB is up")
            return
        except pymysql.err.Error as error:
            if time.monotonic() >= deadline:
                msg = f"MariaDB unreachable at {target} after {MARIADB_PROBE_TIMEOUT}s: {error}"
                raise RuntimeError(msg) from error
            print(f"⏳ MariaDB not ready yet: {error}")
            time.sleep(MARIADB_PROBE_INTERVAL)


def _ensure_database() -> None:
    """Create this worker's database and grant it to the app user.

    Each E2E worker owns a database that nothing else creates, so the backend
    creates its own: the runner then needs no SQL client of its own.
    """
    database = SECRET.MARIADB_DATABASE
    user = SECRET.MARIADB_USER
    with _root_connect() as conn, conn.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{database}`")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{database}`.* TO '{user}'@'%'")
        cursor.execute("FLUSH PRIVILEGES")
        conn.commit()
    print(f"✅ Database {database} ready for user {user}")


if __name__ == "__main__":
    _wait_for_mariadb()
    _ensure_database()
    reset()
    port = int(os.environ.get("PORT", "8001"))
    print(
        f"\n🧪 TEST MODE\n"
        f"  API      : http://localhost:{port}\n"
        f"  DB       : {SECRET.MARIADB_DATABASE} @ {SECRET.MARIADB_HOST}:{SECRET.MARIADB_PORT}\n"
        f"  DB user  : {SECRET.MARIADB_USER}\n"
    )
    # reload=False: the WatchFiles autoreloader has no place in E2E/CI — a stray
    # file change mid-run would restart the server and break in-flight tests.
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
