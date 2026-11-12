import asyncio
import os

os.environ["MODE"] = "testing"

import time

import psycopg
import uvicorn
from psycopg import sql

from src.fixtures.reset_db import reset
from src.security.secrets import SECRET

# The E2E PostgreSQL has no readiness gate in front of it: CI starts the backends
# while its image is still being pulled (~25s), so waiting is this script's job.
POSTGRES_PROBE_INTERVAL = 2
POSTGRES_PROBE_TIMEOUT = 60


def _maintenance_connect() -> psycopg.Connection:
    """Connect to the `postgres` maintenance database: the worker's may not exist yet."""
    return psycopg.connect(
        host=SECRET.POSTGRES_HOST,
        port=SECRET.POSTGRES_PORT,
        user=SECRET.POSTGRES_USER,
        password=SECRET.POSTGRES_PASSWORD,
        dbname="postgres",
        autocommit=True,
        connect_timeout=5,
    )


def _wait_for_postgres() -> None:
    """Poll PostgreSQL until it answers a real query.

    A TCP connect is not enough: Docker publishes the host port through
    docker-proxy, which accepts connections before postgres listens behind it.
    """
    target = f"{SECRET.POSTGRES_HOST}:{SECRET.POSTGRES_PORT}"
    deadline = time.monotonic() + POSTGRES_PROBE_TIMEOUT
    print(f"🚀 Waiting for PostgreSQL at {target}")
    while True:
        try:
            with _maintenance_connect() as conn:  # NOSONAR S9408 false positive
                conn.execute("SELECT 1")
            print("✅ PostgreSQL is up")
            return
        except psycopg.Error as error:
            if time.monotonic() >= deadline:
                msg = f"PostgreSQL unreachable at {target} after {POSTGRES_PROBE_TIMEOUT}s: {error}"
                raise RuntimeError(msg) from error
            print(f"⏳ PostgreSQL not ready yet: {error}")
            time.sleep(POSTGRES_PROBE_INTERVAL)


def _ensure_database() -> None:
    """Create this worker's database unless it already exists.

    Each E2E worker owns a database that nothing else creates, so the backend
    creates its own: the runner then needs no SQL client of its own.
    """
    database = SECRET.POSTGRES_DB
    with _maintenance_connect() as conn:  # NOSONAR S9408 false positive
        found = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database,))
        if found.fetchone() is None:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    print(f"✅ Database {database} ready for user {SECRET.POSTGRES_USER}")


if __name__ == "__main__":
    _wait_for_postgres()
    _ensure_database()
    reset()
    port = int(os.environ.get("PORT", "8001"))
    print(
        f"\n🧪 TEST MODE\n"
        f"  API      : http://localhost:{port}\n"
        f"  DB       : {SECRET.POSTGRES_DB} @ {SECRET.POSTGRES_HOST}:{SECRET.POSTGRES_PORT}\n"
        f"  DB user  : {SECRET.POSTGRES_USER}\n"
    )
    # reload=False: the WatchFiles autoreloader has no place in E2E/CI — a stray
    # file change mid-run would restart the server and break in-flight tests.
    server = uvicorn.Server(uvicorn.Config("main:app", host="127.0.0.1", port=port, reload=False))
    # Windows: without a reload subprocess uvicorn picks the Proactor loop, which psycopg refuses.
    asyncio.run(server.serve(), loop_factory=asyncio.SelectorEventLoop)
