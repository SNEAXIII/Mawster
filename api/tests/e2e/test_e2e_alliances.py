"""E2E tests — Alliances lifecycle.

Covers create → get → update → delete, member invitations, accept/decline,
officers, groups, member removal, eligibility, and my-roles.
Only Discord OAuth is mocked.
"""
import uuid

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import discord_login, auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────

async def _login(client: AsyncClient, token: str = "discord_token_user1") -> dict:
    return auth_headers((await discord_login(client, token))["access_token"])


async def _create_account(client: AsyncClient, hdrs: dict, pseudo: str = "Player1", primary: bool = True) -> dict:
    resp = await client.post("/game-accounts", json={"game_pseudo": pseudo, "is_primary": primary}, headers=hdrs)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_alliance(client: AsyncClient, hdrs: dict, owner_id: str,
                            name: str = "TestAlliance", tag: str = "TST") -> dict:
    resp = await client.post(
        "/alliances",
        json={"name": name, "tag": tag, "owner_id": owner_id},
        headers=hdrs,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _setup_alliance_with_2_users(client: AsyncClient):
    """Create 2 users, give user1 a game account, create an alliance, return (h1, h2, alliance, owner_acc)."""
    h1 = await _login(client, "discord_token_user1")
    h2 = await _login(client, "discord_token_user2")
    owner_acc = await _create_account(client, h1, "OwnerPlayer")
    alliance = await _create_alliance(client, h1, owner_acc["id"])
    return h1, h2, alliance, owner_acc


# =========================================================================
# CREATE
# =========================================================================

class TestCreateAlliance:
    @pytest.mark.asyncio
    async def test_create_ok(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "Creator")
        alliance = await _create_alliance(client, h1, acc["id"], "MyAlliance", "MY")
        assert alliance["name"] == "MyAlliance"
        assert alliance["tag"] == "MY"
        assert alliance["member_count"] == 1
        assert alliance["owner_id"] == acc["id"]

    @pytest.mark.asyncio
    async def test_create_no_auth(self, client: AsyncClient):
        resp = await client.post(
            "/alliances",
            json={"name": "X", "tag": "X", "owner_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_with_someone_elses_account(self, client: AsyncClient):
        h1 = await _login(client, "discord_token_user1")
        h2 = await _login(client, "discord_token_user2")
        acc2 = await _create_account(client, h2, "User2Acc")

        resp = await client.post(
            "/alliances",
            json={"name": "Stolen", "tag": "STL", "owner_id": acc2["id"]},
            headers=h1,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_account_already_in_alliance(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "AlreadyIn")
        await _create_alliance(client, h1, acc["id"])

        resp = await client.post(
            "/alliances",
            json={"name": "Second", "tag": "S", "owner_id": acc["id"]},
            headers=h1,
        )
        assert resp.status_code == 409


# =========================================================================
# GET alliances
# =========================================================================

class TestGetAlliances:
    @pytest.mark.asyncio
    async def test_get_all(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "ALister")
        await _create_alliance(client, h1, acc["id"])

        resp = await client.get("/alliances", headers=h1)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_get_mine(self, client: AsyncClient):
        h1 = await _login(client, "discord_token_user1")
        h2 = await _login(client, "discord_token_user2")

        acc1 = await _create_account(client, h1, "U1Player")
        await _create_alliance(client, h1, acc1["id"], "MyAlliance", "MY")

        acc2 = await _create_account(client, h2, "U2Player")
        await _create_alliance(client, h2, acc2["id"], "TheirAlliance", "TR")

        resp = await client.get("/alliances/mine", headers=h1)
        assert resp.status_code == 200
        names = [a["name"] for a in resp.json()]
        assert "MyAlliance" in names
        assert "TheirAlliance" not in names

    @pytest.mark.asyncio
    async def test_get_by_id(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "GetById")
        alliance = await _create_alliance(client, h1, acc["id"])

        resp = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        assert resp.status_code == 200
        assert resp.json()["id"] == alliance["id"]

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, client: AsyncClient):
        h1 = await _login(client)
        resp = await client.get(f"/alliances/{uuid.uuid4()}", headers=h1)
        assert resp.status_code == 404


# =========================================================================
# UPDATE
# =========================================================================

class TestUpdateAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_update(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "Updater")
        alliance = await _create_alliance(client, h1, acc["id"])

        resp = await client.put(
            f"/alliances/{alliance['id']}",
            json={"name": "Updated", "tag": "UPD", "owner_id": acc["id"]},
            headers=h1,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    @pytest.mark.asyncio
    async def test_non_owner_cannot_update(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)

        resp = await client.put(
            f"/alliances/{alliance['id']}",
            json={"name": "Hacked", "tag": "H", "owner_id": str(uuid.uuid4())},
            headers=h2,
        )
        assert resp.status_code == 403


# =========================================================================
# DELETE
# =========================================================================

class TestDeleteAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_delete(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "Deleter")
        alliance = await _create_alliance(client, h1, acc["id"])

        resp = await client.delete(f"/alliances/{alliance['id']}", headers=h1)
        assert resp.status_code == 204

        resp2 = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        assert resp2.status_code == 404

    @pytest.mark.asyncio
    async def test_non_owner_cannot_delete(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        resp = await client.delete(f"/alliances/{alliance['id']}", headers=h2)
        assert resp.status_code == 403


# =========================================================================
# INVITATIONS (invite, accept, decline, cancel, list)
# =========================================================================

class TestInvitations:
    @pytest.mark.asyncio
    async def test_invite_accept_flow(self, client: AsyncClient):
        """Owner invites user2's game account → user2 accepts → user2 becomes member."""
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "InvitedPlayer")

        # Invite
        resp = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        assert resp.status_code == 201
        invitation = resp.json()
        assert invitation["status"] == "pending"

        # User2 sees invitation
        resp_my_inv = await client.get("/alliances/my-invitations", headers=h2)
        assert resp_my_inv.status_code == 200
        assert len(resp_my_inv.json()) == 1

        # Accept
        resp_accept = await client.post(
            f"/alliances/invitations/{invitation['id']}/accept",
            headers=h2,
        )
        assert resp_accept.status_code == 200
        assert resp_accept.json()["status"] == "accepted"

        # Verify member count increased
        resp_alliance = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        assert resp_alliance.json()["member_count"] == 2

    @pytest.mark.asyncio
    async def test_invite_decline_flow(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "DeclinedPlayer")

        resp = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        invitation = resp.json()

        resp_decline = await client.post(
            f"/alliances/invitations/{invitation['id']}/decline",
            headers=h2,
        )
        assert resp_decline.status_code == 200
        assert resp_decline.json()["status"] == "declined"

        # Member count unchanged
        resp_alliance = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        assert resp_alliance.json()["member_count"] == 1

    @pytest.mark.asyncio
    async def test_cancel_invitation(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "CancelledPlayer")

        resp = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        invitation = resp.json()

        resp_cancel = await client.delete(
            f"/alliances/{alliance['id']}/invitations/{invitation['id']}",
            headers=h1,
        )
        assert resp_cancel.status_code == 200

    @pytest.mark.asyncio
    async def test_non_member_cannot_invite(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        h3 = await _login(client, "discord_token_user3")
        acc3 = await _create_account(client, h3, "RandomPlayer")

        resp = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc3["id"]},
            headers=h2,  # user2 is NOT in the alliance
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_invite_no_auth(self, client: AsyncClient):
        resp = await client.post(
            f"/alliances/{uuid.uuid4()}/invitations",
            json={"game_account_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_list_alliance_invitations(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "ListedInvitee")

        await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )

        resp = await client.get(
            f"/alliances/{alliance['id']}/invitations",
            headers=h1,
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# =========================================================================
# OFFICERS
# =========================================================================

class TestOfficers:
    @pytest.mark.asyncio
    async def test_add_and_remove_officer(self, client: AsyncClient):
        """Owner invites user2, user2 accepts, owner promotes user2 to officer, then removes."""
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "OfficerCandidate")

        # Invite + accept
        inv_resp = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        await client.post(
            f"/alliances/invitations/{inv_resp.json()['id']}/accept",
            headers=h2,
        )

        # Add officer
        resp_add = await client.post(
            f"/alliances/{alliance['id']}/officers",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        assert resp_add.status_code == 201

        # Verify officer via GET
        resp_get = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        officers = resp_get.json().get("officers", [])
        officer_ids = [o["game_account_id"] for o in officers]
        assert acc2["id"] in officer_ids

        # Remove officer
        resp_rm = await client.request(
            "DELETE",
            f"/alliances/{alliance['id']}/officers",
            headers=h1,
            json={"game_account_id": acc2["id"]},
        )
        assert resp_rm.status_code == 200

        # Verify officer removed via GET
        resp_get2 = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        officers_after = resp_get2.json().get("officers", [])
        officer_ids_after = [o["game_account_id"] for o in officers_after]
        assert acc2["id"] not in officer_ids_after

    @pytest.mark.asyncio
    async def test_non_owner_cannot_add_officer(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "NotAllowedOfficer")

        # Invite + accept
        inv = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        await client.post(
            f"/alliances/invitations/{inv.json()['id']}/accept",
            headers=h2,
        )

        # user2 tries to promote themselves
        resp = await client.post(
            f"/alliances/{alliance['id']}/officers",
            json={"game_account_id": acc2["id"]},
            headers=h2,
        )
        assert resp.status_code == 403


# =========================================================================
# GROUP assignment
# =========================================================================

class TestGroups:
    @pytest.mark.asyncio
    async def test_set_member_group(self, client: AsyncClient):
        h1, h2, alliance, owner_acc = await _setup_alliance_with_2_users(client)

        # Owner sets their own group
        resp = await client.patch(
            f"/alliances/{alliance['id']}/members/{owner_acc['id']}/group",
            json={"group": 1},
            headers=h1,
        )
        assert resp.status_code == 200
        members = resp.json().get("members", [])
        owner = next(m for m in members if m["id"] == owner_acc["id"])
        assert owner["alliance_group"] == 1

    @pytest.mark.asyncio
    async def test_set_group_invalid_value(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "GroupInvalid")
        alliance = await _create_alliance(client, h1, acc["id"])

        resp = await client.patch(
            f"/alliances/{alliance['id']}/members/{acc['id']}/group",
            json={"group": 5},
            headers=h1,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_set_group_null(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "GroupNull")
        alliance = await _create_alliance(client, h1, acc["id"])

        # Set group 2, then unset
        await client.patch(
            f"/alliances/{alliance['id']}/members/{acc['id']}/group",
            json={"group": 2},
            headers=h1,
        )
        resp = await client.patch(
            f"/alliances/{alliance['id']}/members/{acc['id']}/group",
            json={"group": None},
            headers=h1,
        )
        assert resp.status_code == 200


# =========================================================================
# REMOVE MEMBER
# =========================================================================

class TestRemoveMember:
    @pytest.mark.asyncio
    async def test_owner_removes_member(self, client: AsyncClient):
        h1, h2, alliance, _ = await _setup_alliance_with_2_users(client)
        acc2 = await _create_account(client, h2, "Removeable")

        inv = await client.post(
            f"/alliances/{alliance['id']}/invitations",
            json={"game_account_id": acc2["id"]},
            headers=h1,
        )
        await client.post(
            f"/alliances/invitations/{inv.json()['id']}/accept",
            headers=h2,
        )

        resp = await client.delete(
            f"/alliances/{alliance['id']}/members/{acc2['id']}",
            headers=h1,
        )
        assert resp.status_code == 200

        # Verify via GET
        resp_get = await client.get(f"/alliances/{alliance['id']}", headers=h1)
        assert resp_get.json()["member_count"] == 1

    @pytest.mark.asyncio
    async def test_non_member_cannot_remove(self, client: AsyncClient):
        h1, h2, alliance, owner_acc = await _setup_alliance_with_2_users(client)

        resp = await client.delete(
            f"/alliances/{alliance['id']}/members/{owner_acc['id']}",
            headers=h2,
        )
        assert resp.status_code == 403


# =========================================================================
# MY ROLES
# =========================================================================

class TestMyRoles:
    @pytest.mark.asyncio
    async def test_my_roles_owner(self, client: AsyncClient):
        h1 = await _login(client)
        acc = await _create_account(client, h1, "RoleOwner")
        alliance = await _create_alliance(client, h1, acc["id"])

        resp = await client.get("/alliances/my-roles", headers=h1)
        assert resp.status_code == 200
        body = resp.json()
        assert "roles" in body
        assert "my_account_ids" in body
        alliance_id = alliance["id"]
        assert alliance_id in body["roles"]
        assert body["roles"][alliance_id]["is_owner"] is True

    @pytest.mark.asyncio
    async def test_my_roles_no_auth(self, client: AsyncClient):
        resp = await client.get("/alliances/my-roles")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_my_roles_no_alliance(self, client: AsyncClient):
        h1 = await _login(client)
        await _create_account(client, h1, "Lonely")

        resp = await client.get("/alliances/my-roles", headers=h1)
        assert resp.status_code == 200
        body = resp.json()
        assert body["roles"] == {}


# =========================================================================
# ELIGIBILITY endpoints
# =========================================================================

class TestEligibility:
    @pytest.mark.asyncio
    async def test_eligible_owners(self, client: AsyncClient):
        h1 = await _login(client)
        acc1 = await _create_account(client, h1, "Free1")
        acc2 = await _create_account(client, h1, "Free2", primary=False)

        resp = await client.get("/alliances/eligible-owners", headers=h1)
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert acc1["id"] in ids
        assert acc2["id"] in ids

        # After creating an alliance, the owner is no longer eligible
        await _create_alliance(client, h1, acc1["id"])
        resp2 = await client.get("/alliances/eligible-owners", headers=h1)
        ids2 = [a["id"] for a in resp2.json()]
        assert acc1["id"] not in ids2
        assert acc2["id"] in ids2

    @pytest.mark.asyncio
    async def test_eligible_members(self, client: AsyncClient):
        h1 = await _login(client, "discord_token_user1")
        h2 = await _login(client, "discord_token_user2")
        acc2 = await _create_account(client, h2, "FreeAcc")

        resp = await client.get("/alliances/eligible-members", headers=h1)
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert acc2["id"] in ids
