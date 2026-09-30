from collections.abc import AsyncGenerator, Sequence
from functools import cache

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession

IS_ECHO = False
IS_ECHO_ASYNC = False

# Named shared-cache memory DB: the sync and async engines see the same tables. Each
# xdist worker is its own process, so each gets its own instance.
DB_URL = "/file:mawster_test?mode=memory&cache=shared&uri=true"

sqlite_sync_engine = create_engine(f"sqlite://{DB_URL}", echo=IS_ECHO)
sqlite_async_engine = create_async_engine(f"sqlite+aiosqlite://{DB_URL}", echo=IS_ECHO_ASYNC)

Session = async_sessionmaker(
    bind=sqlite_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Track whether the schema has already been created in this process.
_schema_ready = False


@cache
def _truncate_script() -> str:
    # Built on first use, not at import: metadata only lists the models imported by then.
    # The PRAGMAs sit outside BEGIN/COMMIT: SQLite ignores foreign_keys inside a transaction.
    deletes = "".join(
        f'DELETE FROM "{table.name}";'  # noqa: S608, the table names come from SQLModel.metadata
        for table in reversed(SQLModel.metadata.sorted_tables)
    )
    return f"PRAGMA foreign_keys = OFF; BEGIN; {deletes} COMMIT; PRAGMA foreign_keys = ON;"


def ensure_schema():
    """Create all tables once per process (idempotent)."""
    global _schema_ready  # noqa: PLW0603 — process-wide "schema created" memo, by design
    if not _schema_ready:
        SQLModel.metadata.create_all(sqlite_sync_engine)
        _schema_ready = True


def _truncate_all():
    """Fast truncation: DELETE rows from every table."""
    # executescript runs the whole script in one call; SQLAlchemy's execute() takes one statement.
    conn = sqlite_sync_engine.raw_connection()
    try:
        conn.driver_connection.executescript(_truncate_script())
    finally:
        conn.close()


def reset_test_db():
    """Prepare a clean DB for a single test function.

    First call: creates schema.  Every call: truncates all rows.
    No more engine dispose / DROP ALL / CREATE ALL per test.
    """
    ensure_schema()
    _truncate_all()


async def get_test_session() -> AsyncGenerator[AsyncSession]:
    async with Session() as session:
        yield session


async def load_objects(objects: Sequence[SQLModel]) -> None:
    async with AsyncSession(
        sqlite_async_engine,
        expire_on_commit=False,
    ) as session:
        for _object in objects:
            session.add(_object)
        await session.commit()
