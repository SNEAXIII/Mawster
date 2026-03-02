"""E2E tests — Authentication & User management.

Covers the full flow from Discord login → session check → token refresh → account deletion.
Nothing is mocked except `DiscordAuthService.verify_discord_token`.
"""
import pytest
from httpx import AsyncClient

from tests.e2e.conftest import discord_login, auth_headers


# =========================================================================
# Discord Login
# =========================================================================

class TestDiscordLogin:
    """POST /auth/discord — login via (mocked) Discord OAuth."""

    @pytest.mark.asyncio
    async def test_login_creates_user_and_returns_tokens(self, client: AsyncClient):
        data = await discord_login(client, "discord_token_user1")
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_second_login_returns_same_user(self, client: AsyncClient):
        """Logging in twice with the same Discord token should return tokens for the same user."""
        data1 = await discord_login(client, "discord_token_user1")
        data2 = await discord_login(client, "discord_token_user1")

        # Both tokens should decode to the same user
        resp1 = await client.get("/auth/session", headers=auth_headers(data1["access_token"]))
        resp2 = await client.get("/auth/session", headers=auth_headers(data2["access_token"]))
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json()["discord_id"] == resp2.json()["discord_id"]

    @pytest.mark.asyncio
    async def test_login_different_discord_users(self, client: AsyncClient):
        """Two different Discord accounts create two different users."""
        d1 = await discord_login(client, "discord_token_user1")
        d2 = await discord_login(client, "discord_token_user2")

        r1 = await client.get("/auth/session", headers=auth_headers(d1["access_token"]))
        r2 = await client.get("/auth/session", headers=auth_headers(d2["access_token"]))
        assert r1.json()["discord_id"] != r2.json()["discord_id"]

    @pytest.mark.asyncio
    async def test_login_invalid_discord_token(self, client: AsyncClient):
        resp = await client.post("/auth/discord", json={"access_token": "totally_invalid"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_empty_discord_token(self, client: AsyncClient):
        resp = await client.post("/auth/discord", json={"access_token": ""})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_missing_body(self, client: AsyncClient):
        resp = await client.post("/auth/discord", json={})
        assert resp.status_code == 400


# =========================================================================
# Session check
# =========================================================================

class TestGetSession:
    """GET /auth/session — verify JWT and get profile."""

    @pytest.mark.asyncio
    async def test_session_returns_profile(self, client: AsyncClient):
        tokens = await discord_login(client)
        resp = await client.get("/auth/session", headers=auth_headers(tokens["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert "discord_id" in body
        assert "login" in body
        assert "email" in body
        assert body["role"] == "user"

    @pytest.mark.asyncio
    async def test_session_no_auth(self, client: AsyncClient):
        resp = await client.get("/auth/session")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_session_invalid_token(self, client: AsyncClient):
        resp = await client.get("/auth/session", headers=auth_headers("garbage.token"))
        assert resp.status_code == 401


# =========================================================================
# POST /auth/session (body-based)
# =========================================================================

class TestPostSession:
    """POST /auth/session — validate token via body."""

    @pytest.mark.asyncio
    async def test_post_session_valid_token(self, client: AsyncClient):
        tokens = await discord_login(client)
        resp = await client.post("/auth/session", json={"token": tokens["access_token"]})
        assert resp.status_code == 200
        assert "login" in resp.json()

    @pytest.mark.asyncio
    async def test_post_session_invalid_token(self, client: AsyncClient):
        resp = await client.post("/auth/session", json={"token": "invalid"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_post_session_missing_token_field(self, client: AsyncClient):
        resp = await client.post("/auth/session", json={})
        assert resp.status_code == 400


# =========================================================================
# Token Refresh
# =========================================================================

class TestTokenRefresh:
    """POST /auth/refresh — obtain new tokens from refresh_token."""

    @pytest.mark.asyncio
    async def test_refresh_ok(self, client: AsyncClient):
        tokens = await discord_login(client)
        resp = await client.post(
            "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert resp.status_code == 200
        new_tokens = resp.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens

        # New access token works
        resp2 = await client.get("/auth/session", headers=auth_headers(new_tokens["access_token"]))
        assert resp2.status_code == 200

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(self, client: AsyncClient):
        """Using an access_token as refresh_token should fail."""
        tokens = await discord_login(client)
        resp = await client.post(
            "/auth/refresh", json={"refresh_token": tokens["access_token"]}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post("/auth/refresh", json={"refresh_token": "garbage"})
        assert resp.status_code == 401


# =========================================================================
# Self-delete
# =========================================================================

class TestUserSelfDelete:
    """DELETE /user/delete — user deletes their own account."""

    @pytest.mark.asyncio
    async def test_self_delete_ok(self, client: AsyncClient):
        tokens = await discord_login(client)
        hdrs = auth_headers(tokens["access_token"])

        # Delete
        resp = await client.request(
            "DELETE", "/user/delete", headers=hdrs,
            json={"confirmation": "SUPPRIMER"},
        )
        assert resp.status_code == 200

        # Session should now fail (deleted user)
        resp2 = await client.get("/auth/session", headers=hdrs)
        assert resp2.status_code != 200

    @pytest.mark.asyncio
    async def test_self_delete_wrong_confirmation(self, client: AsyncClient):
        tokens = await discord_login(client)
        hdrs = auth_headers(tokens["access_token"])

        resp = await client.request(
            "DELETE", "/user/delete", headers=hdrs,
            json={"confirmation": "wrong"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_self_delete_no_auth(self, client: AsyncClient):
        resp = await client.request(
            "DELETE", "/user/delete",
            json={"confirmation": "SUPPRIMER"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_self_delete_twice(self, client: AsyncClient):
        tokens = await discord_login(client)
        hdrs = auth_headers(tokens["access_token"])

        await client.request(
            "DELETE", "/user/delete", headers=hdrs,
            json={"confirmation": "SUPPRIMER"},
        )
        # Try to re-login (user soft-deleted, Discord login should recreate? or fail?)
        # The user is soft-deleted so the token still decodes but the user check fails
        resp = await client.request(
            "DELETE", "/user/delete", headers=hdrs,
            json={"confirmation": "SUPPRIMER"},
        )
        assert resp.status_code != 200
