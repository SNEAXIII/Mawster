import os
import time
from typing import List

from sqlmodel import SQLModel, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text


IS_ECHO = False
IS_ECHO_ASYNC = False

# ── Per-worker DB name (pytest-xdist support) ──────────────────────────
# Each xdist worker gets PYTEST_XDIST_WORKER env var (gw0, gw1, …).
# When running without xdist the var is absent → single "test.db".
_worker = os.environ.get("PYTEST_XDIST_WORKER", "")
DB_NAME = f"temp/test_{_worker}.db" if _worker else "temp/test.db"

sqlite_sync_engine = create_engine(
    f"sqlite:///{DB_NAME}", echo=IS_ECHO,
)
sqlite_async_engine = create_async_engine(
    url=f"sqlite+aiosqlite:///{DB_NAME}", echo=IS_ECHO_ASYNC,
)

Session = sessionmaker(
    bind=sqlite_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Track whether the schema has already been created in this process.
_schema_ready = False


def delete_db(retries: int = 20, delay: float = 0.2):
    """Delete the DB file on disk (opt-in via TEST_DELETE_DB env var)."""
    if os.getenv("TEST_DELETE_DB") in ("1", "true", "True"):
        if os.path.exists(DB_NAME):
            for attempt in range(retries):
                try:
                    os.remove(DB_NAME)
                    return
                except PermissionError:
                    time.sleep(delay)
            os.remove(DB_NAME)


def ensure_schema():
    """Create all tables once per process (idempotent)."""
    global _schema_ready
    if not _schema_ready:
        SQLModel.metadata.create_all(sqlite_sync_engine)
        _schema_ready = True


def _truncate_all():
    """Fast truncation: DELETE rows from every table + reset sequences.

    Much faster than DROP ALL / CREATE ALL on every test.
    """
    with sqlite_sync_engine.begin() as conn:
        # Disable FK checks for speed during truncation
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        for table in reversed(SQLModel.metadata.sorted_tables):
            conn.execute(text(f'DELETE FROM "{table.name}"'))
        # Reset SQLite AUTOINCREMENT sequences
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
        )
        if result.first():
            conn.execute(text("DELETE FROM sqlite_sequence"))
        conn.execute(text("PRAGMA foreign_keys = ON"))


def reset_test_db():
    """Prepare a clean DB for a single test function.

    First call: creates schema.  Every call: truncates all rows.
    No more engine dispose / DROP ALL / CREATE ALL per test.
    """
    ensure_schema()
    _truncate_all()



async def get_test_session() -> AsyncSession:
    async with Session() as session:
        yield session


async def load_objects(objects: List[SQLModel]) -> None:
    async with AsyncSession(
        sqlite_async_engine,
        expire_on_commit=False,
    ) as session:
        for _object in objects:
            session.add(_object)
        await session.commit()
