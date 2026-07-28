import pytest_asyncio

from tests.utils.utils_db import Session, reset_test_db


@pytest_asyncio.fixture
async def session():
    """Real async DB session backed by the project's SQLite test engine.

    Needed here (and not just a FakeSession) because the ordering guarantee
    that `position` provides can only be proven by round-tripping through an
    actual database — an in-memory list proves nothing about row order.
    """
    reset_test_db()
    async with Session() as session:
        yield session
