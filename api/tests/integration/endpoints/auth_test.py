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
from tests.utils.utils_client import (
    execute_get_request,
    execute_post_request,
    create_auth_headers,
)
from tests.utils.utils_constant import USER_LOGIN, USER_ID, USER_EMAIL
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

# --- Constants ---
REGEX_BEARER = re.compile(r"(eyJ[\da-zA-Z]+\.){2}[\w-]+")
TOKEN_TYPE = "bearer"
ENDPOINT_SESSION = "/auth/session"

# --- Utility functions ---
def _create_jwt(
    login=USER_LOGIN,
    user_id=str(USER_ID),
    email=USER_EMAIL,
    role=Roles.USER,
) -> str:
    """Create a valid JWT token for testing /auth/session."""
    return JWTService.create_token(
        {"sub": login, "user_id": user_id, "email": email, "role": role}
    )


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
        assert body["email"] == USER_EMAIL

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
            "sub": USER_LOGIN,
            "user_id": str(USER_ID),
            "email": USER_EMAIL,
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
        headers = create_auth_headers(login="ghost_user")
        response = await execute_get_request(ENDPOINT_SESSION, headers=headers)
        assert response.status_code == 401


# =========================================================================
# POST /auth/session (body-based)
# =========================================================================


class TestPostSession:
    """POST /auth/session — token in request body."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_200(self):
        await push_one_user()
        token = _create_jwt()
        response = await execute_post_request(
            ENDPOINT_SESSION, payload={"token": token}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN
        assert body["email"] == USER_EMAIL

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self):
        response = await execute_post_request(
            ENDPOINT_SESSION, payload={"token": "garbage"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_token_returns_error(self):
        response = await execute_post_request(
            ENDPOINT_SESSION, payload={"token": ""}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_token_field_returns_400(self):
        response = await execute_post_request(ENDPOINT_SESSION, payload={})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_deleted_user_token_returns_error(self):
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        token = _create_jwt()
        response = await execute_post_request(
            ENDPOINT_SESSION, payload={"token": token}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_disabled_user_token_returns_error(self):
        user = get_generic_user(is_base_id=True, disabled_at=datetime.now())
        await load_objects([user])
        token = _create_jwt()
        response = await execute_post_request(
            ENDPOINT_SESSION, payload={"token": token}
        )
        assert response.status_code == 401


# =========================================================================
# POST /auth/discord
# =========================================================================


class TestDiscordLogin:
    """POST /auth/discord — Discord OAuth2 flow."""

    @pytest.mark.asyncio
    async def test_missing_access_token_returns_400(self):
        response = await execute_post_request("/auth/discord", payload={})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_access_token_returns_error(self):
        """An empty access_token should not succeed."""
        response = await execute_post_request(
            "/auth/discord", payload={"access_token": ""}
        )
        # Discord API call will fail → 401 or 502
        assert response.status_code in (401, 502)
