"""E2E tests — Defense placement management.

Covers placing defenders, viewing defense layouts, removing defenders,
clearing a battlegroup, viewing available champions, and BG member info.

Setup: alliance with 2 members in the same BG, champions loaded, roster populated.
Only Discord OAuth is mocked.
"""
import uuid

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import discord_login, auth_headers
from tests.utils.utils_db import Session


# ── Helpers ─────────────────────────────────────────────────────────────

async def _login(client: AsyncClient, token: str = "discord_token_user1") -> dict:
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
    import jwt
    payload = jwt.decode(access_token, options={"verify_signature": False})
    return payload["user_id"]


async def _create_game_account(client: AsyncClient, hdrs: dict, pseudo: str = "TestAcc") -> dict:
    resp = await client.post("/game-accounts", json={"game_pseudo": pseudo}, headers=hdrs)
    assert resp.status_code == 201
    return resp.json()


async def _setup_admin(client: AsyncClient, token: str = "discord_token_admin") -> dict:
    t = await _login(client, token)
    user_id = _user_id_from_token(t["access_token"])
    await _promote(user_id, "admin")
    t2 = await _login(client, token)
    return _hdrs(t2)


async def _load_champions(client: AsyncClient, admin_hdrs: dict, names: list[str]):
    champs = [{"name": n, "champion_class": "Science", "is_7_star": False} for n in names]
    resp = await client.post("/admin/champions/load", json=champs, headers=admin_hdrs)
    assert resp.status_code == 200


async def _get_champion_id(client: AsyncClient, admin_hdrs: dict, name: str) -> str:
    resp = await client.get(f"/admin/champions?search={name}", headers=admin_hdrs)
    return resp.json()["champions"][0]["id"]


async def _add_champion_to_roster(
    client: AsyncClient, hdrs: dict, ga_id: str, champ_id: str, rarity: str = "6r4"
) -> dict:
    resp = await client.post("/champion-users", json={
        "game_account_id": ga_id,
        "champion_id": champ_id,
        "rarity": rarity,
        "signature": 0,
    }, headers=hdrs)
    assert resp.status_code == 201
    return resp.json()


async def _create_alliance_with_member(client: AsyncClient):
    """
    Create an alliance owned by user1 with user2 as a member in BG1.
    Returns (admin_hdrs, user1_hdrs, user2_hdrs, alliance_id, ga1_id, ga2_id).
    Also loads Spider-Man and Iron Man champions and adds them to both rosters.
    """
    # Admin for champion loading
    admin_hdrs = await _setup_admin(client)
    await _load_champions(client, admin_hdrs, ["Spider-Man", "Iron Man"])
    champ1_id = await _get_champion_id(client, admin_hdrs, "Spider-Man")
    champ2_id = await _get_champion_id(client, admin_hdrs, "Iron Man")

    # User 1 (owner)
    t1 = await _login(client, "discord_token_user1")
    h1 = _hdrs(t1)
    ga1 = await _create_game_account(client, h1, "Owner")

    # Create alliance
    resp = await client.post("/alliances", json={"name": "DefenseAlliance", "tag": "DEF", "owner_id": ga1["id"]}, headers=h1)
    assert resp.status_code == 201
    alliance_id = resp.json()["id"]

    # User 2
    t2 = await _login(client, "discord_token_user2")
    h2 = _hdrs(t2)
    ga2 = await _create_game_account(client, h2, "Member")

    # Invite and accept user 2
    invite_resp = await client.post(
        f"/alliances/{alliance_id}/invitations",
        json={"game_account_id": ga2["id"]},
        headers=h1,
    )
    assert invite_resp.status_code == 201
    inv_id = invite_resp.json()["id"]
    accept_resp = await client.post(f"/alliances/invitations/{inv_id}/accept", headers=h2)
    assert accept_resp.status_code == 200

    # Set BG groups: both in BG 1
    await client.patch(
        f"/alliances/{alliance_id}/members/{ga1['id']}/group",
        json={"group": 1},
        headers=h1,
    )
    await client.patch(
        f"/alliances/{alliance_id}/members/{ga2['id']}/group",
        json={"group": 1},
        headers=h1,
    )

    # Add champions to both rosters
    cu1_spidey = await _add_champion_to_roster(client, h1, ga1["id"], champ1_id, "6r4")
    cu1_iron = await _add_champion_to_roster(client, h1, ga1["id"], champ2_id, "7r1")
    cu2_spidey = await _add_champion_to_roster(client, h2, ga2["id"], champ1_id, "6r5")

    return {
        "admin_hdrs": admin_hdrs,
        "h1": h1, "h2": h2,
        "alliance_id": alliance_id,
        "ga1_id": ga1["id"], "ga2_id": ga2["id"],
        "cu1_spidey_id": cu1_spidey["id"],
        "cu1_iron_id": cu1_iron["id"],
        "cu2_spidey_id": cu2_spidey["id"],
    }


# =========================================================================
# Defense — View / Place / Remove / Clear
# =========================================================================

class TestDefensePlacement:
    @pytest.mark.asyncio
    async def test_get_empty_defense(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1",
            headers=ctx["h1"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["battlegroup"] == 1
        assert body["placements"] == []

    @pytest.mark.asyncio
    async def test_place_defender(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        resp = await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 1,
                "champion_user_id": ctx["cu1_spidey_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h1"],
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["node_number"] == 1
        assert body["champion_name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_place_multiple_defenders(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        # Owner places own champion on node 1
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 1,
                "champion_user_id": ctx["cu1_spidey_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h1"],
        )
        # Owner places own champion on node 2
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 2,
                "champion_user_id": ctx["cu1_iron_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h1"],
        )

        # Check defense
        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1",
            headers=ctx["h1"],
        )
        assert resp.status_code == 200
        assert len(resp.json()["placements"]) == 2

    @pytest.mark.asyncio
    async def test_owner_can_place_for_member(self, client: AsyncClient):
        """Owner/officer can place a defender for another member."""
        ctx = await _create_alliance_with_member(client)
        resp = await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 5,
                "champion_user_id": ctx["cu2_spidey_id"],
                "game_account_id": ctx["ga2_id"],
            },
            headers=ctx["h1"],  # owner places for member
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_member_cannot_place_for_others(self, client: AsyncClient):
        """Regular member can only place own champions."""
        ctx = await _create_alliance_with_member(client)
        resp = await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 5,
                "champion_user_id": ctx["cu1_spidey_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h2"],  # member tries to place owner's champion
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_battlegroup(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/4",
            headers=ctx["h1"],
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_non_member_cannot_view_defense(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        t3 = await _login(client, "discord_token_user3")
        h3 = _hdrs(t3)
        await _create_game_account(client, h3, "Outsider")

        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1",
            headers=h3,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_remove_defender_from_node(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        # Place a defender
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 10,
                "champion_user_id": ctx["cu1_spidey_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h1"],
        )

        # Remove it (owner = officer, so can remove)
        resp = await client.delete(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/node/10",
            headers=ctx["h1"],
        )
        assert resp.status_code == 204

        # Verify gone
        defense = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1",
            headers=ctx["h1"],
        )
        assert len(defense.json()["placements"]) == 0

    @pytest.mark.asyncio
    async def test_member_cannot_remove_defender(self, client: AsyncClient):
        """Only officers/owners can remove defenders."""
        ctx = await _create_alliance_with_member(client)
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={
                "node_number": 10,
                "champion_user_id": ctx["cu1_spidey_id"],
                "game_account_id": ctx["ga1_id"],
            },
            headers=ctx["h1"],
        )

        resp = await client.delete(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/node/10",
            headers=ctx["h2"],  # regular member
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_clear_defense(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        # Place two defenders
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={"node_number": 1, "champion_user_id": ctx["cu1_spidey_id"], "game_account_id": ctx["ga1_id"]},
            headers=ctx["h1"],
        )
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={"node_number": 2, "champion_user_id": ctx["cu1_iron_id"], "game_account_id": ctx["ga1_id"]},
            headers=ctx["h1"],
        )

        # Clear all
        resp = await client.delete(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/clear",
            headers=ctx["h1"],
        )
        assert resp.status_code == 204

        # Verify empty
        defense = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1",
            headers=ctx["h1"],
        )
        assert len(defense.json()["placements"]) == 0

    @pytest.mark.asyncio
    async def test_member_cannot_clear_defense(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)
        resp = await client.delete(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/clear",
            headers=ctx["h2"],
        )
        assert resp.status_code == 403


# =========================================================================
# Available champions & BG members
# =========================================================================

class TestDefenseQueries:
    @pytest.mark.asyncio
    async def test_get_available_champions(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)

        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/available-champions",
            headers=ctx["h1"],
        )
        assert resp.status_code == 200
        body = resp.json()
        # Should list champions from BG1 members not yet placed
        assert isinstance(body, list)
        assert len(body) >= 1

    @pytest.mark.asyncio
    async def test_available_champions_excludes_placed(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)

        # Get initial available count
        resp1 = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/available-champions",
            headers=ctx["h1"],
        )
        initial_count = len(resp1.json())

        # Place one champion
        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={"node_number": 1, "champion_user_id": ctx["cu1_spidey_id"], "game_account_id": ctx["ga1_id"]},
            headers=ctx["h1"],
        )

        # Available should decrease
        resp2 = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/available-champions",
            headers=ctx["h1"],
        )
        assert len(resp2.json()) == initial_count - 1

    @pytest.mark.asyncio
    async def test_get_bg_members(self, client: AsyncClient):
        ctx = await _create_alliance_with_member(client)

        resp = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/members",
            headers=ctx["h1"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        # Both users are in BG 1
        assert len(body) >= 2

    @pytest.mark.asyncio
    async def test_no_auth_returns_403(self, client: AsyncClient):
        resp = await client.get(f"/alliances/{uuid.uuid4()}/defense/bg/1")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_defense_different_battlegroups_isolated(self, client: AsyncClient):
        """Placements in BG1 don't show in BG2."""
        ctx = await _create_alliance_with_member(client)

        await client.post(
            f"/alliances/{ctx['alliance_id']}/defense/bg/1/place",
            json={"node_number": 1, "champion_user_id": ctx["cu1_spidey_id"], "game_account_id": ctx["ga1_id"]},
            headers=ctx["h1"],
        )

        resp_bg2 = await client.get(
            f"/alliances/{ctx['alliance_id']}/defense/bg/2",
            headers=ctx["h1"],
        )
        assert resp_bg2.status_code == 200
        assert len(resp_bg2.json()["placements"]) == 0
