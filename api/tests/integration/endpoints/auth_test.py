"""Integration tests for /auth endpoints.

Covers:
- GET /auth/session with Authorization header (valid, missing, expired, malformed)
- POST /auth/session with token body (deleted user, disabled user)
- POST /auth/discord
- Strict status code assertions
"""

import re
from datetime import datetime

import jwt as pyjwt
import pytest

from main import app
from src.enums.Roles import Roles
from src.security.secrets import SECRET
from src.services.JWTService import JWTService
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    push_one_user,
    get_generic_user,
)
from src.utils.email_hash import hash_email
from src.models import User
from tests.utils.utils_client import (
    execute_get_request,
    execute_post_request,
    create_auth_headers,
)
from tests.utils.utils_constant import USER_LOGIN, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

# --- Constants ---
REGEX_BEARER = re.compile(r"(eyJ[\da-zA-Z]+\.){2}[\w-]+")
TOKEN_TYPE = "bearer"
ENDPOINT_SESSION = "/auth/session"
ENDPOINT_DISCORD = "/auth/discord"
ENDPOINT_REFRESH = "/auth/refresh"
ENDPOINT_DEV_SESSION = "/dev/session"
ENDPOINT_DEV_USERS = "/dev/users"
ENDPOINT_DEV_LOGIN = "/dev/login"


# --- Utility functions ---
def _create_jwt(
    user_id=str(USER_ID),
    role=Roles.USER,
) -> str:
    """Create a valid JWT token for testing."""
    return JWTService.create_token({"user_id": user_id, "role": role, "type": "access"})


# =========================================================================
# GET /auth/session (Authorization header based)
# =========================================================================


class TestGetSession:
    """GET /auth/session — header-based authentication."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_200(self):
        await push_one_user()
        headers = create_auth_headers()
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN

    @pytest.mark.asyncio
    async def test_no_auth_header_returns_401(self):
        response = await execute_get_request(ENDPOINT_SESSION)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self):
        headers = {"Authorization": "Bearer not.a.valid.jwt"}
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_bearer_returns_401(self):
        headers = {"Authorization": "Bearer "}
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self):
        """An expired JWT should yield 401, not 200."""
        payload = {
            "user_id": str(USER_ID),
            "role": Roles.USER,
            "exp": 0,  # expired in 1970
        }
        token = pyjwt.encode(payload, SECRET.SECRET_KEY, algorithm="HS256")
        headers = {"Authorization": f"Bearer {token}"}
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_for_deleted_user_returns_error(self):
        """A valid token for a soft-deleted user must not return 200."""
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        headers = create_auth_headers()
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_for_disabled_user_returns_error(self):
        """A valid token for a disabled user must not return 200."""
        user = get_generic_user(is_base_id=True, disabled_at=datetime.now())
        await load_objects([user])
        headers = create_auth_headers()
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_for_nonexistent_user_returns_error(self):
        """Token with a login that doesn't exist in DB."""
        headers = create_auth_headers()
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401


# =========================================================================
# POST /auth/session (body-based)
# =========================================================================


class TestPostSession:
    """POST /dev/session — token in request body (dev only)."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_200(self):
        await push_one_user()
        token = _create_jwt()
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={"token": token})
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self):
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={"token": "garbage"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_token_returns_error(self):
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={"token": ""})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_token_field_returns_422(self):
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_deleted_user_token_returns_error(self):
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        token = _create_jwt()
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={"token": token})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_disabled_user_token_returns_error(self):
        user = get_generic_user(is_base_id=True, disabled_at=datetime.now())
        await load_objects([user])
        token = _create_jwt()
        response = await execute_post_request(ENDPOINT_DEV_SESSION, payload={"token": token})
        assert response.status_code == 401


# =========================================================================
# POST /auth/discord
# =========================================================================


class TestDiscordLogin:
    """POST /auth/discord — Discord OAuth2 flow."""

    @pytest.mark.asyncio
    async def test_missing_access_token_returns_422(self):
        response = await execute_post_request(ENDPOINT_DISCORD, payload={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_access_token_returns_error(self):
        """An empty access_token should not succeed."""
        response = await execute_post_request(ENDPOINT_DISCORD, payload={"access_token": ""})
        # Discord API call will fail → 401 or 502
        assert response.status_code in (401, 502)

    @pytest.mark.asyncio
    async def test_valid_access_token_returns_tokens(self):
        """A non-empty access_token succeeds via the mocked Discord verifier."""
        response = await execute_post_request(
            ENDPOINT_DISCORD, payload={"access_token": "valid-discord-token"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == TOKEN_TYPE
        assert REGEX_BEARER.match(body["access_token"])
        assert REGEX_BEARER.match(body["refresh_token"])

    @pytest.mark.asyncio
    async def test_duplicate_email_hash_returns_409(self):
        """A Discord login whose email is already used by another account returns 409."""
        # The mock always returns email="test@example.com" with discord_id=1.
        # Pre-insert a user with the same email but a different discord_id.
        existing = User(
            login="otheruser",
            email_hash=hash_email("test@example.com"),
            discord_id="other_discord_999",
            role=Roles.USER,
        )
        await load_objects([existing])

        response = await execute_post_request(
            ENDPOINT_DISCORD, payload={"access_token": "valid-discord-token"}
        )
        assert response.status_code == 409


# =========================================================================
# POST /auth/refresh — refresh token exchange
# =========================================================================


class TestRefreshToken:
    """POST /auth/refresh — exchange a refresh token for new tokens."""

    @pytest.mark.asyncio
    async def test_valid_refresh_returns_new_tokens(self):
        """A valid refresh token yields a fresh access + refresh pair."""
        await push_one_user()
        user = get_generic_user(is_base_id=True)
        refresh_token = JWTService.create_refresh_token(user)

        response = await execute_post_request(
            ENDPOINT_REFRESH, payload={"refresh_token": refresh_token}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == TOKEN_TYPE
        assert REGEX_BEARER.match(body["access_token"])
        assert REGEX_BEARER.match(body["refresh_token"])

    @pytest.mark.asyncio
    async def test_access_token_as_refresh_returns_error(self):
        """An access token must not be accepted as a refresh token."""
        await push_one_user()
        access_token = _create_jwt()

        response = await execute_post_request(
            ENDPOINT_REFRESH, payload={"refresh_token": access_token}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_garbage_refresh_returns_error(self):
        response = await execute_post_request(
            ENDPOINT_REFRESH, payload={"refresh_token": "not.a.token"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_refresh_returns_error(self):
        payload = {"user_id": str(USER_ID), "type": "refresh", "exp": 0}
        token = pyjwt.encode(payload, SECRET.SECRET_KEY, algorithm="HS256")
        response = await execute_post_request(ENDPOINT_REFRESH, payload={"refresh_token": token})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_for_deleted_user_returns_error(self):
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        refresh_token = JWTService.create_refresh_token(user)
        response = await execute_post_request(
            ENDPOINT_REFRESH, payload={"refresh_token": refresh_token}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_refresh_field_returns_error(self):
        response = await execute_post_request(ENDPOINT_REFRESH, payload={})
        assert response.status_code in (400, 422)


# =========================================================================
# Dev-only endpoints
# =========================================================================


class TestDevEndpoints:
    """GET /dev/users and POST /dev/login — available only in non-prod."""

    @pytest.mark.asyncio
    async def test_dev_list_users_returns_all(self):
        """List all users via the dev endpoint."""
        await push_one_user()
        response = await execute_get_request(ENDPOINT_DEV_USERS)
        assert response.status_code == 200
        body = response.json()
        assert len(body) >= 1
        user_entry = body[0]
        assert "id" in user_entry
        assert "login" in user_entry
        assert "email_hash" in user_entry
        assert "role" in user_entry

    @pytest.mark.asyncio
    async def test_dev_list_users_empty_db(self):
        """No users in the DB → empty list."""
        response = await execute_get_request(ENDPOINT_DEV_USERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_dev_login_valid_user(self):
        """Dev login with a valid user_id returns token pair."""
        await push_one_user()
        response = await execute_post_request(ENDPOINT_DEV_LOGIN, payload={"user_id": str(USER_ID)})
        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == TOKEN_TYPE
        assert REGEX_BEARER.match(body["access_token"])
        assert REGEX_BEARER.match(body["refresh_token"])

    @pytest.mark.asyncio
    async def test_dev_login_nonexistent_user(self):
        """Dev login with a non-existent user_id should fail."""
        response = await execute_post_request(ENDPOINT_DEV_LOGIN, payload={"user_id": str(USER_ID)})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_dev_login_deleted_user(self):
        """Dev login with a deleted user should fail."""
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        response = await execute_post_request(ENDPOINT_DEV_LOGIN, payload={"user_id": str(USER_ID)})
        assert response.status_code == 401
