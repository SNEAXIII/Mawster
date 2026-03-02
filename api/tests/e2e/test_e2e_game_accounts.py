"""E2E tests — Game Accounts CRUD.

Full lifecycle: create → list → get → update → delete game accounts.
Uses real backend with only Discord OAuth mocked.
"""
import pytest
from httpx import AsyncClient

from tests.e2e.conftest import discord_login, auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────

async def _login_and_get_headers(client: AsyncClient, token: str = "discord_token_user1") -> dict:
    tokens = await discord_login(client, token)
    return auth_headers(tokens["access_token"])


async def _create_account(client: AsyncClient, hdrs: dict, pseudo: str = "Player1", primary: bool = False) -> dict:
    resp = await client.post(
        "/game-accounts",
        json={"game_pseudo": pseudo, "is_primary": primary},
        headers=hdrs,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# =========================================================================
# CREATE
# =========================================================================

class TestCreateGameAccount:
    @pytest.mark.asyncio
    async def test_create_ok(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        body = await _create_account(client, hdrs, "MyPlayer", True)
        assert body["game_pseudo"] == "MyPlayer"
        assert body["is_primary"] is True
        assert "id" in body
        assert "user_id" in body

    @pytest.mark.asyncio
    async def test_create_multiple_accounts(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        a1 = await _create_account(client, hdrs, "Acc1")
        a2 = await _create_account(client, hdrs, "Acc2")
        assert a1["id"] != a2["id"]

    @pytest.mark.asyncio
    async def test_create_no_auth(self, client: AsyncClient):
        resp = await client.post(
            "/game-accounts",
            json={"game_pseudo": "Test", "is_primary": False},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_empty_body(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        resp = await client.post("/game-accounts", json={}, headers=hdrs)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_pseudo_too_long(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        resp = await client.post(
            "/game-accounts",
            json={"game_pseudo": "A" * 51, "is_primary": False},
            headers=hdrs,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_10_accounts_limit(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        for i in range(10):
            await _create_account(client, hdrs, f"Player{i}")
        resp = await client.post(
            "/game-accounts",
            json={"game_pseudo": "Player11", "is_primary": False},
            headers=hdrs,
        )
        assert resp.status_code == 400


# =========================================================================
# LIST
# =========================================================================

class TestListGameAccounts:
    @pytest.mark.asyncio
    async def test_list_empty(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        resp = await client.get("/game-accounts", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_own_accounts(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        await _create_account(client, hdrs, "A1")
        await _create_account(client, hdrs, "A2")

        resp = await client.get("/game-accounts", headers=hdrs)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @pytest.mark.asyncio
    async def test_list_does_not_show_other_users(self, client: AsyncClient):
        h1 = await _login_and_get_headers(client, "discord_token_user1")
        h2 = await _login_and_get_headers(client, "discord_token_user2")
        await _create_account(client, h2, "OtherPlayer")

        resp = await client.get("/game-accounts", headers=h1)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_list_primary_first(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        await _create_account(client, hdrs, "NonPrimary", False)
        await _create_account(client, hdrs, "Primary", True)

        resp = await client.get("/game-accounts", headers=hdrs)
        body = resp.json()
        assert body[0]["is_primary"] is True


# =========================================================================
# GET single
# =========================================================================

class TestGetGameAccount:
    @pytest.mark.asyncio
    async def test_get_own_account(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        acc = await _create_account(client, hdrs, "TestGet")
        resp = await client.get(f"/game-accounts/{acc['id']}", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["game_pseudo"] == "TestGet"

    @pytest.mark.asyncio
    async def test_get_other_user_account_403(self, client: AsyncClient):
        h1 = await _login_and_get_headers(client, "discord_token_user1")
        h2 = await _login_and_get_headers(client, "discord_token_user2")
        acc = await _create_account(client, h2, "OtherAcc")

        resp = await client.get(f"/game-accounts/{acc['id']}", headers=h1)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_nonexistent_404(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        import uuid
        resp = await client.get(f"/game-accounts/{uuid.uuid4()}", headers=hdrs)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_invalid_uuid_400(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        resp = await client.get("/game-accounts/not-a-uuid", headers=hdrs)
        assert resp.status_code == 400


# =========================================================================
# UPDATE
# =========================================================================

class TestUpdateGameAccount:
    @pytest.mark.asyncio
    async def test_update_ok(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        acc = await _create_account(client, hdrs, "OldName")

        resp = await client.put(
            f"/game-accounts/{acc['id']}",
            json={"game_pseudo": "NewName", "is_primary": True},
            headers=hdrs,
        )
        assert resp.status_code == 200
        assert resp.json()["game_pseudo"] == "NewName"
        assert resp.json()["is_primary"] is True

    @pytest.mark.asyncio
    async def test_update_other_user_403(self, client: AsyncClient):
        h1 = await _login_and_get_headers(client, "discord_token_user1")
        h2 = await _login_and_get_headers(client, "discord_token_user2")
        acc = await _create_account(client, h2, "OtherAcc")

        resp = await client.put(
            f"/game-accounts/{acc['id']}",
            json={"game_pseudo": "Stolen", "is_primary": False},
            headers=h1,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_update_nonexistent_404(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        import uuid
        resp = await client.put(
            f"/game-accounts/{uuid.uuid4()}",
            json={"game_pseudo": "X", "is_primary": False},
            headers=hdrs,
        )
        assert resp.status_code == 404


# =========================================================================
# DELETE
# =========================================================================

class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_ok(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        acc = await _create_account(client, hdrs, "ToDelete")

        resp = await client.delete(f"/game-accounts/{acc['id']}", headers=hdrs)
        assert resp.status_code == 204

        # Verify gone
        resp2 = await client.get(f"/game-accounts/{acc['id']}", headers=hdrs)
        assert resp2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_other_user_403(self, client: AsyncClient):
        h1 = await _login_and_get_headers(client, "discord_token_user1")
        h2 = await _login_and_get_headers(client, "discord_token_user2")
        acc = await _create_account(client, h2, "VictimAccount")

        resp = await client.delete(f"/game-accounts/{acc['id']}", headers=h1)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_twice_404(self, client: AsyncClient):
        hdrs = await _login_and_get_headers(client)
        acc = await _create_account(client, hdrs, "TwiceDelete")

        await client.delete(f"/game-accounts/{acc['id']}", headers=hdrs)
        resp = await client.delete(f"/game-accounts/{acc['id']}", headers=hdrs)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_no_auth(self, client: AsyncClient):
        resp = await client.delete("/game-accounts/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 403
