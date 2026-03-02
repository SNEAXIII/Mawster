"""
E2E test configuration.

Spins up a real FastAPI backend via ASGI transport backed by an in-process
SQLite database.  The ONLY thing that is mocked is the Discord OAuth call
(`DiscordAuthService.verify_discord_token`) so tests can obtain valid JWTs
without hitting the Discord API.

Every test function gets a clean (truncated) database, and a shared
`httpx.AsyncClient` is available through the `client` fixture.
"""

import pytest
import pytest_asyncio
from collections.abc import Iterator

from httpx import AsyncClient, ASGITransport

from main import app
from src.utils.db import get_session
from tests.utils.utils_db import reset_test_db, delete_db, get_test_session

# ── Discord mock ────────────────────────────────────────────────────────
from src.services.DiscordAuthService import (
    DiscordAuthService,
    DISCORD_TOKEN_INVALID_EXCEPTION,
)

# Fake Discord profiles keyed by access_token for multi-user flows
_DISCORD_PROFILES: dict[str, dict] = {
    "discord_token_user1": {
        "id": "111111111111111111",
        "username": "testuser1",
        "email": "user1@example.com",
        "avatar": None,
    },
    "discord_token_user2": {
        "id": "222222222222222222",
        "username": "testuser2",
        "email": "user2@example.com",
        "avatar": None,
    },
    "discord_token_user3": {
        "id": "333333333333333333",
        "username": "testuser3",
        "email": "user3@example.com",
        "avatar": None,
    },
    "discord_token_admin": {
        "id": "999999999999999999",
        "username": "adminuser",
        "email": "admin@example.com",
        "avatar": None,
    },
}

_original_verify = DiscordAuthService.verify_discord_token


async def _fake_verify(cls, access_token: str):
    """Return a deterministic Discord profile based on access_token, or raise."""
    if not access_token:
        raise DISCORD_TOKEN_INVALID_EXCEPTION
    profile = _DISCORD_PROFILES.get(access_token)
    if profile is None:
        raise DISCORD_TOKEN_INVALID_EXCEPTION
    return profile


# ── Fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True, scope="function")
def reset_db() -> Iterator:
    """Clean DB + wire test session for every test function."""
    reset_test_db()
    app.dependency_overrides[get_session] = get_test_session
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def manage_test_db():
    """Delete DB file at session boundaries."""
    delete_db()
    yield
    delete_db()


@pytest_asyncio.fixture(scope="module")
async def client():
    """Shared AsyncClient with mocked Discord for the whole test module."""
    DiscordAuthService.verify_discord_token = classmethod(_fake_verify)
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as c:
        yield c
    DiscordAuthService.verify_discord_token = _original_verify


# ── Helpers available to all e2e tests ──────────────────────────────────

async def discord_login(client: AsyncClient, discord_token: str = "discord_token_user1") -> dict:
    """Perform a Discord login and return the response JSON containing access_token & refresh_token."""
    resp = await client.post("/auth/discord", json={"access_token": discord_token})
    assert resp.status_code == 200, f"Discord login failed: {resp.text}"
    return resp.json()


def auth_headers(token: str) -> dict[str, str]:
    """Build Authorization header from an access_token."""
    return {"Authorization": f"Bearer {token}"}
