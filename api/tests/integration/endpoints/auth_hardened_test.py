"""Hardened integration tests for /auth endpoints.

Covers:
- GET /auth/session with Authorization header (valid, missing, expired, malformed)
- POST /auth/session with token body (deleted user, disabled user)
- Strict status code assertions
"""
import pytest

from src.enums.Roles import Roles
from main import app
from src.services.JWTService import JWTService
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    push_one_user,
    get_generic_user,
)
from tests.utils.utils_constant import USER_LOGIN, USER_ID, USER_EMAIL
from tests.utils.utils_db import get_test_session, load_objects
from tests.utils.utils_client import (
    execute_get_request,
    execute_post_request,
    create_auth_headers,
)
from datetime import datetime

app.dependency_overrides[get_session] = get_test_session


def _create_token(
    login=USER_LOGIN,
    user_id=str(USER_ID),
    email=USER_EMAIL,
    role=Roles.USER,
) -> str:
    return JWTService.create_token(
        {"sub": login, "user_id": user_id, "email": email, "role": role}
    )


# =========================================================================
# GET /auth/session (Authorization header based)
# =========================================================================


class TestGetSession:
    """GET /auth/session — header-based authentication."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_200(self, session):
        await push_one_user()
        headers = create_auth_headers()
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN
        assert body["email"] == USER_EMAIL

    @pytest.mark.asyncio
    async def test_no_auth_header_returns_401(self, session):
        response = await execute_get_request("/auth/session")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self, session):
        headers = {"Authorization": "Bearer not.a.valid.jwt"}
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_bearer_returns_401(self, session):
        headers = {"Authorization": "Bearer "}
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self, session):
        """An expired JWT should yield 401, not 200."""
        import jwt as pyjwt
        from src.security.secrets import SECRET

        payload = {
            "sub": USER_LOGIN,
            "user_id": str(USER_ID),
            "email": USER_EMAIL,
            "role": Roles.USER,
            "exp": 0,  # expired in 1970
        }
        token = pyjwt.encode(payload, SECRET.SECRET_KEY, algorithm="HS256")
        headers = {"Authorization": f"Bearer {token}"}
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_for_deleted_user_returns_error(self, session):
        """A valid token for a soft-deleted user must not return 200."""
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        headers = create_auth_headers()
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code != 200
        assert response.status_code in (401, 403, 404)

    @pytest.mark.asyncio
    async def test_token_for_disabled_user_returns_error(self, session):
        """A valid token for a disabled user must not return 200."""
        user = get_generic_user(is_base_id=True, disabled_at=datetime.now())
        await load_objects([user])
        headers = create_auth_headers()
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code != 200
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_token_for_nonexistent_user_returns_error(self, session):
        """Token with a login that doesn't exist in DB."""
        headers = create_auth_headers(login="ghost_user")
        response = await execute_get_request("/auth/session", headers=headers)
        assert response.status_code != 200
        assert response.status_code in (401, 404)


# =========================================================================
# POST /auth/session (body-based)
# =========================================================================


class TestPostSession:
    """POST /auth/session — token in request body."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_200(self, session):
        await push_one_user()
        token = _create_token()
        response = await execute_post_request(
            "/auth/session", payload={"token": token}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self, session):
        response = await execute_post_request(
            "/auth/session", payload={"token": "garbage"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_token_returns_error(self, session):
        response = await execute_post_request(
            "/auth/session", payload={"token": ""}
        )
        assert response.status_code in (401, 422)

    @pytest.mark.asyncio
    async def test_missing_token_field_returns_400(self, session):
        response = await execute_post_request("/auth/session", payload={})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_deleted_user_token_returns_error(self, session):
        user = get_generic_user(is_base_id=True, deleted_at=datetime.now())
        await load_objects([user])
        token = _create_token()
        response = await execute_post_request(
            "/auth/session", payload={"token": token}
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_disabled_user_token_returns_error(self, session):
        user = get_generic_user(is_base_id=True, disabled_at=datetime.now())
        await load_objects([user])
        token = _create_token()
        response = await execute_post_request(
            "/auth/session", payload={"token": token}
        )
        assert response.status_code != 200


# =========================================================================
# POST /auth/discord
# =========================================================================


class TestDiscordLogin:
    """POST /auth/discord — Discord OAuth2 flow."""

    @pytest.mark.asyncio
    async def test_missing_access_token_returns_400(self, session):
        response = await execute_post_request("/auth/discord", payload={})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_access_token_returns_error(self, session):
        """An empty access_token should not succeed."""
        response = await execute_post_request(
            "/auth/discord", payload={"access_token": ""}
        )
        # Discord API call will fail → 401 or 502
        assert response.status_code in (401, 502)


# =========================================================================
# Non-existent auth routes
# =========================================================================


class TestRemovedRoutes:
    """Verify legacy auth endpoints no longer exist."""

    @pytest.mark.asyncio
    async def test_login_endpoint_gone(self, session):
        response = await execute_post_request(
            "/auth/login", payload={"username": "x", "password": "x"}
        )
        assert response.status_code in (404, 405)

    @pytest.mark.asyncio
    async def test_register_endpoint_gone(self, session):
        response = await execute_post_request(
            "/auth/register",
            payload={"login": "x", "email": "x@x.com", "password": "X1!xxxxx"},
        )
        assert response.status_code in (404, 405)
