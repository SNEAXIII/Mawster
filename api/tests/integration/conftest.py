import pytest_asyncio
import pytest
from collections.abc import Iterator

from main import app
from src.utils.db import get_session
from tests.utils.utils_db import reset_test_db, delete_db, Session, get_test_session
from httpx import AsyncClient, ASGITransport



@pytest.fixture(autouse=True, scope="function")
def reset_db() -> Iterator:
    # Setup
    reset_test_db()
    app.dependency_overrides[get_session] = get_test_session

    # Test
    yield

    # Teardown
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def session():
    async with Session() as session:
        yield session


@pytest.fixture(scope="session", autouse=True)
def delete_test_db():
    delete_db()
    yield
    delete_db()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def test_client_fixture():
    """Provide a reusable `AsyncClient` to helpers via `tests.utils.utils_client._SHARED_CLIENT`.

    This fixture is autouse so existing helpers keep working without changing tests.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        # Import inside fixture to avoid import cycles at module import time
        import tests.utils.utils_client as utils_client
        utils_client._SHARED_CLIENT = client

        # Patch DiscordAuthService.verify_discord_token to avoid real network calls
        from src.services.DiscordAuthService import (
            DiscordAuthService,
            DISCORD_TOKEN_INVALID_EXCEPTION,
        )

        original_verify = DiscordAuthService.verify_discord_token

        async def _fake_verify(cls, access_token: str):
            # Fast deterministic behavior: empty token -> invalid, else return fake profile
            if not access_token:
                raise DISCORD_TOKEN_INVALID_EXCEPTION
            return {"id": 1, "username": "testuser", "email": "test@example.com"}

        DiscordAuthService.verify_discord_token = classmethod(_fake_verify)

        try:
            yield
        finally:
            # Restore original method and shared client
            DiscordAuthService.verify_discord_token = original_verify
            utils_client._SHARED_CLIENT = None
