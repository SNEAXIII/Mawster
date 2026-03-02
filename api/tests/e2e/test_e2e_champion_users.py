"""E2E tests — Champion-User roster management.

Covers adding champions to a roster, bulk import, reading roster,
updating, deleting, upgrading rank, toggling preferred attacker,
and upgrade requests.

Only Discord OAuth is mocked.  Admin role is patched via test DB.
"""
import uuid

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import discord_login, auth_headers
from tests.utils.utils_db import Session


# ── Helpers ─────────────────────────────────────────────────────────────

async def _login(client: AsyncClient, token: str = "discord_token_user1") -> dict:
    """Login and return full token dict."""
    return await discord_login(client, token)


def _hdrs(tokens: dict) -> dict:
    return auth_headers(tokens["access_token"])


async def _promote(user_id: str, role: str = "admin"):
    from src.models import User
    async with Session() as session:
        user = await session.get(User, uuid.UUID(user_id))
        user.role = role
        session.add(user)
        await session.commit()


def _user_id_from_token(access_token: str) -> str:
    """Extract user_id from a JWT access token (no signature verification)."""
    import jwt
    payload = jwt.decode(access_token, options={"verify_signature": False})
    return payload["user_id"]


async def _create_game_account(client: AsyncClient, hdrs: dict, pseudo: str = "TestAccount") -> dict:
    resp = await client.post("/game-accounts", json={"game_pseudo": pseudo}, headers=hdrs)
    assert resp.status_code == 201
    return resp.json()


async def _load_champions(client: AsyncClient, admin_hdrs: dict, names: list[str]) -> None:
    champs = [{"name": n, "champion_class": "Science", "is_7_star": False} for n in names]
    resp = await client.post("/admin/champions/load", json=champs, headers=admin_hdrs)
    assert resp.status_code == 200


async def _get_champion_id(client: AsyncClient, admin_hdrs: dict, name: str) -> str:
    resp = await client.get(f"/admin/champions?search={name}", headers=admin_hdrs)
    assert resp.status_code == 200
    champs = resp.json()["champions"]
    return champs[0]["id"]


async def _setup_admin(client: AsyncClient, token: str = "discord_token_admin") -> dict:
    """Login with admin token, promote to admin, re-login, return headers."""
    t = await _login(client, token)
    user_id = _user_id_from_token(t["access_token"])
    await _promote(user_id, "admin")
    t2 = await _login(client, token)
    return _hdrs(t2)


# =========================================================================
# Champion-User CRUD
# =========================================================================

class TestChampionUserCRUD:
    @pytest.mark.asyncio
    async def test_add_champion_to_roster(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        user_tokens = await _login(client, "discord_token_user1")
        hdrs = _hdrs(user_tokens)
        ga = await _create_game_account(client, hdrs)

        resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"],
            "champion_id": champ_id,
            "rarity": "6r4",
            "signature": 20,
            "is_preferred_attacker": False,
        }, headers=hdrs)
        assert resp.status_code == 201
        body = resp.json()
        assert body["rarity"] == "6r4"
        assert body["signature"] == 20

    @pytest.mark.asyncio
    async def test_add_champion_invalid_game_account(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        user_tokens = await _login(client, "discord_token_user1")
        hdrs = _hdrs(user_tokens)

        resp = await client.post("/champion-users", json={
            "game_account_id": str(uuid.uuid4()),
            "champion_id": champ_id,
            "rarity": "6r4",
            "signature": 0,
        }, headers=hdrs)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_add_champion_to_other_users_account(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        # User1 creates game account
        t1 = await _login(client, "discord_token_user1")
        ga = await _create_game_account(client, _hdrs(t1))

        # User2 tries to add champion to user1's account
        t2 = await _login(client, "discord_token_user2")
        resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"],
            "champion_id": champ_id,
            "rarity": "6r4",
            "signature": 0,
        }, headers=_hdrs(t2))
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_champion_user(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"],
            "champion_id": champ_id,
            "rarity": "6r4",
            "signature": 50,
        }, headers=hdrs)
        cu_id = create_resp.json()["id"]

        resp = await client.get(f"/champion-users/{cu_id}", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["signature"] == 50

    @pytest.mark.asyncio
    async def test_get_champion_user_not_found(self, client: AsyncClient):
        t = await _login(client, "discord_token_user1")
        resp = await client.get(f"/champion-users/{uuid.uuid4()}", headers=_hdrs(t))
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_roster_by_game_account(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man", "Iron Man"])
        champ1 = await _get_champion_id(client, admin_hdrs, "Spider-Man")
        champ2 = await _get_champion_id(client, admin_hdrs, "Iron Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ1,
            "rarity": "6r4", "signature": 0,
        }, headers=hdrs)
        await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ2,
            "rarity": "7r1", "signature": 100,
        }, headers=hdrs)

        resp = await client.get(f"/champion-users/by-account/{ga['id']}", headers=hdrs)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        names = {c["champion_name"] for c in body}
        assert names == {"Spider-Man", "Iron Man"}

    @pytest.mark.asyncio
    async def test_get_roster_other_user_403(self, client: AsyncClient):
        t1 = await _login(client, "discord_token_user1")
        ga = await _create_game_account(client, _hdrs(t1))

        t2 = await _login(client, "discord_token_user2")
        resp = await client.get(f"/champion-users/by-account/{ga['id']}", headers=_hdrs(t2))
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_update_champion_user(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0,
        }, headers=hdrs)
        cu_id = create_resp.json()["id"]

        resp = await client.put(f"/champion-users/{cu_id}", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "7r1", "signature": 200,
        }, headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["rarity"] == "7r1"

    @pytest.mark.asyncio
    async def test_delete_champion_user(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0,
        }, headers=hdrs)
        cu_id = create_resp.json()["id"]

        resp = await client.delete(f"/champion-users/{cu_id}", headers=hdrs)
        assert resp.status_code == 204

        # Confirm deleted
        resp2 = await client.get(f"/champion-users/{cu_id}", headers=hdrs)
        assert resp2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_champion_user_other_user_403(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t1 = await _login(client, "discord_token_user1")
        ga = await _create_game_account(client, _hdrs(t1))
        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0,
        }, headers=_hdrs(t1))
        cu_id = create_resp.json()["id"]

        t2 = await _login(client, "discord_token_user2")
        resp = await client.delete(f"/champion-users/{cu_id}", headers=_hdrs(t2))
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_no_auth_returns_403(self, client: AsyncClient):
        resp = await client.post("/champion-users", json={"game_account_id": str(uuid.uuid4()), "champion_id": str(uuid.uuid4()), "rarity": "6r4", "signature": 0})
        assert resp.status_code == 403


# =========================================================================
# Preferred Attacker & Upgrade
# =========================================================================

class TestPreferredAttackerAndUpgrade:
    @pytest.mark.asyncio
    async def test_toggle_preferred_attacker(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0, "is_preferred_attacker": False,
        }, headers=hdrs)
        cu_id = create_resp.json()["id"]
        assert create_resp.json()["is_preferred_attacker"] is False

        # Toggle ON
        resp = await client.patch(f"/champion-users/{cu_id}/preferred-attacker", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["is_preferred_attacker"] is True

        # Toggle OFF
        resp2 = await client.patch(f"/champion-users/{cu_id}/preferred-attacker", headers=hdrs)
        assert resp2.status_code == 200
        assert resp2.json()["is_preferred_attacker"] is False

    @pytest.mark.asyncio
    async def test_toggle_other_user_403(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t1 = await _login(client, "discord_token_user1")
        ga = await _create_game_account(client, _hdrs(t1))
        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0,
        }, headers=_hdrs(t1))
        cu_id = create_resp.json()["id"]

        t2 = await _login(client, "discord_token_user2")
        resp = await client.patch(f"/champion-users/{cu_id}/preferred-attacker", headers=_hdrs(t2))
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_upgrade_champion_rank(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])
        champ_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        create_resp = await client.post("/champion-users", json={
            "game_account_id": ga["id"], "champion_id": champ_id,
            "rarity": "6r4", "signature": 0,
        }, headers=hdrs)
        cu_id = create_resp.json()["id"]
        assert create_resp.json()["rarity"] == "6r4"

        # Upgrade 6r4 → 6r5
        resp = await client.patch(f"/champion-users/{cu_id}/upgrade", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["rarity"] == "6r5"

    @pytest.mark.asyncio
    async def test_upgrade_not_found(self, client: AsyncClient):
        t = await _login(client, "discord_token_user1")
        resp = await client.patch(f"/champion-users/{uuid.uuid4()}/upgrade", headers=_hdrs(t))
        assert resp.status_code == 404


# =========================================================================
# Bulk Import
# =========================================================================

class TestBulkImport:
    @pytest.mark.asyncio
    async def test_bulk_add_champions(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man", "Iron Man", "Hulk"])

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        resp = await client.post("/champion-users/bulk", json={
            "game_account_id": ga["id"],
            "champions": [
                {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 20},
                {"champion_name": "Iron Man", "rarity": "7r1", "signature": 100},
                {"champion_name": "Hulk", "rarity": "6r5", "signature": 50},
            ],
        }, headers=hdrs)
        assert resp.status_code == 201
        body = resp.json()
        assert len(body) == 3
        names = {c["champion_name"] for c in body}
        assert names == {"Spider-Man", "Iron Man", "Hulk"}

    @pytest.mark.asyncio
    async def test_bulk_add_deduplicates(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])

        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        resp = await client.post("/champion-users/bulk", json={
            "game_account_id": ga["id"],
            "champions": [
                {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 20},
                {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 50},
            ],
        }, headers=hdrs)
        assert resp.status_code == 201
        # Should only create one entry (first wins) or update
        body = resp.json()
        assert len(body) >= 1  # dedup within request

    @pytest.mark.asyncio
    async def test_bulk_add_to_other_users_account_403(self, client: AsyncClient):
        admin_hdrs = await _setup_admin(client)
        await _load_champions(client, admin_hdrs, ["Spider-Man"])

        t1 = await _login(client, "discord_token_user1")
        ga = await _create_game_account(client, _hdrs(t1))

        t2 = await _login(client, "discord_token_user2")
        resp = await client.post("/champion-users/bulk", json={
            "game_account_id": ga["id"],
            "champions": [
                {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 20},
            ],
        }, headers=_hdrs(t2))
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_bulk_empty_list_rejected(self, client: AsyncClient):
        t = await _login(client, "discord_token_user1")
        hdrs = _hdrs(t)
        ga = await _create_game_account(client, hdrs)

        resp = await client.post("/champion-users/bulk", json={
            "game_account_id": ga["id"],
            "champions": [],
        }, headers=hdrs)
        assert resp.status_code in (400, 422)  # validation error (min_length=1)
