import os
import time
import uuid
from typing import List

from sqlmodel import SQLModel, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text


IS_ECHO = False
IS_ECHO_ASYNC = False
DB_NAME = "test.db"

sqlite_sync_engine = create_engine(
    f"sqlite:///{DB_NAME}", echo=IS_ECHO, query_cache_size=0
)
sqlite_async_engine = create_async_engine(
    url=f"sqlite+aiosqlite:///{DB_NAME}", echo=IS_ECHO_ASYNC, query_cache_size=0
)

Session = sessionmaker(
    bind=sqlite_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def delete_db(retries: int = 20, delay: float = 0.2):
    """No-op for test runs: we no longer delete the DB file on disk.

    Tests now reset the schema using SQLModel.metadata.drop_all/create_all
    (truncate behaviour). If you really want to delete the file, set
    the TEST_DELETE_DB env var and the function will attempt removal.
    """
    if os.getenv("TEST_DELETE_DB") in ("1", "true", "True"):
        if os.path.exists(DB_NAME):
            for attempt in range(retries):
                try:
                    os.remove(DB_NAME)
                    return
                except PermissionError:
                    time.sleep(delay)
            os.remove(DB_NAME)


def reset_test_db():
    global sqlite_async_engine, sqlite_sync_engine
    if sqlite_sync_engine:
        try:
            sqlite_sync_engine.dispose()
        except Exception as e:
            print(f"Failed disposing sync engine: {e}")
    if sqlite_async_engine:
        try:
            sqlite_async_engine.sync_engine.dispose()
        except Exception as e:
            print(f"Failed disposing async engine: {e}")
    # Instead of removing the DB file, we drop all tables and recreate them.
    # This gives a truncate-like behaviour and keeps the same DB file.
    try:
        SQLModel.metadata.drop_all(sqlite_sync_engine)
    except Exception as e:
        # If drop_all fails (e.g., first run), ignore and proceed to create_all
        print(f"Warning during drop_all in reset_test_db: {e}")
    SQLModel.metadata.create_all(sqlite_sync_engine)
    # Reset SQLite AUTOINCREMENT sequences (if present) to restart indexes from 1.

    with sqlite_sync_engine.begin() as conn:
        # Check if sqlite_sequence table exists (only on SQLite with AUTOINCREMENT)
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": "sqlite_sequence"},
        )
        row = result.first()
        if row:
            # Delete sequence entries to reset autoincrement counters
            conn.execute(text("DELETE FROM sqlite_sequence"))



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
