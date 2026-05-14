"""Integration tests for /alliances endpoints — CRUD, members, officers, groups, access control."""

import uuid

import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
    push_member,
    push_officer,
    push_visitor,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
    execute_patch_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    GAME_PSEUDO_3,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))

ENDPOINT = "/alliances"
USER3_EMAIL = "user3@gmail.com"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup_2_users():
    """Insert two standard test users."""
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


# =========================================================================
# POST /alliances  (create)
# =========================================================================


class TestCreateAlliance:
    @pytest.mark.asyncio
    async def test_create_ok(self):
        await _setup_2_users()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_post_request(
            ENDPOINT,
            {"name": ALLIANCE_NAME, "tag": ALLIANCE_TAG, "owner_id": str(acc.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == ALLIANCE_NAME
        assert body["tag"] == ALLIANCE_TAG
        assert body["member_count"] == 1

    @pytest.mark.asyncio
    async def test_create_without_auth(self):
        response = await execute_post_request(
            ENDPOINT,
            {"name": "X", "tag": "X", "owner_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def not_your_account(self):
        await _setup_2_users()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO)
        owner_id = str(acc.id)
        response = await execute_post_request(
            ENDPOINT,
            {"name": "X", "tag": "X", "owner_id": owner_id},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def already_in_alliance(self):
        await _setup_2_users()
        _, owner = await push_alliance_with_owner(user_id=USER_ID)
        owner_id = str(owner.id)
        response = await execute_post_request(
            ENDPOINT,
            {"name": "X", "tag": "X", "owner_id": owner_id},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def account_not_found(self):
        await _setup_2_users()
        owner_id = str(uuid.uuid4())
        response = await execute_post_request(
            ENDPOINT,
            {"name": "X", "tag": "X", "owner_id": owner_id},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 404


# =========================================================================
# GET /alliances, /alliances/mine, /alliances/{id}
# =========================================================================


class TestGetAlliances:
    @pytest.mark.asyncio
    async def test_get_all(self):
        await _setup_2_users()
        await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_get_mine(self):
        await _setup_2_users()
        await push_alliance_with_owner(user_id=USER_ID)
        # user2 creates another alliance — user1 should NOT see it in /mine
        await push_alliance_with_owner(
            user_id=USER2_ID,
            game_pseudo="U2Player",
            alliance_name="OtherAlliance",
            alliance_tag="OTH",
        )

        response = await execute_get_request(f"{ENDPOINT}/mine", headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["name"] == ALLIANCE_NAME

    @pytest.mark.asyncio
    async def test_get_by_id(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert response.status_code == 200
        assert response.json()["id"] == str(alliance.id)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self):
        await _setup_2_users()
        response = await execute_get_request(f"{ENDPOINT}/{uuid.uuid4()}", headers=HEADERS_USER1)
        assert response.status_code == 404


# =========================================================================
# PUT /alliances/{id}  (update)
# =========================================================================


class TestUpdateAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_update(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_put_request(
            f"{ENDPOINT}/{alliance.id}",
            {"name": "NewName", "tag": "NEW", "owner_id": str(owner.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "NewName"

    @pytest.mark.asyncio
    async def test_non_owner_cannot_update(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_put_request(
            f"{ENDPOINT}/{alliance.id}",
            {"name": "Hacked", "tag": "H", "owner_id": str(uuid.uuid4())},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /alliances/{id}
# =========================================================================


class TestDeleteAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_delete(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_non_owner_cannot_delete(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER2)
        assert response.status_code == 403


# =========================================================================
# POST /alliances/{id}/invitations  (invite member)
# =========================================================================


class TestInviteMember:
    @pytest.mark.asyncio
    async def test_owner_can_invite_member(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["game_account_pseudo"] == GAME_PSEUDO_2
        assert body["status"] == "pending"

    @pytest.mark.asyncio
    async def test_officer_can_invite_member(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        free_acc = await push_game_account(user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_regular_member_cannot_invite(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        free_acc = await push_game_account(user_id=uuid.uuid4(), game_pseudo=GAME_PSEUDO_3)
        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invite_already_in_alliance(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(member.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_duplicate_pending_invitation(self):
        """Sending a second invitation to the same account should fail."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # First invitation succeeds
        resp1 = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        assert resp1.status_code == 201

        # Second invitation to same account should be 409
        resp2 = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_invite_nonexistent_account(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(uuid.uuid4())},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invite_without_auth(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401


# =========================================================================
# GET /alliances/my-invitations + accept + decline
# =========================================================================


class TestMyInvitations:
    @pytest.mark.asyncio
    async def test_get_my_invitations(self):
        """User2 has a pending invitation → visible via GET /alliances/my-invitations."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # Owner invites user2's account
        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 201

        # User2 fetches their invitations
        resp2 = await execute_get_request(f"{ENDPOINT}/my-invitations", headers=HEADERS_USER2)
        assert resp2.status_code == 200
        body = resp2.json()
        assert len(body) == 1
        assert body[0]["alliance_name"] == ALLIANCE_NAME
        assert body[0]["game_account_pseudo"] == GAME_PSEUDO_2
        assert body[0]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_my_invitations_empty(self):
        """User with no invitations → empty list."""
        await _setup_2_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        resp = await execute_get_request(f"{ENDPOINT}/my-invitations", headers=HEADERS_USER1)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_accept_invitation(self):
        """User2 accepts invitation → joins the alliance."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # Create invitation
        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        invitation_id = resp.json()["id"]

        # Accept invitation
        resp2 = await execute_post_request(
            f"{ENDPOINT}/invitations/{invitation_id}/accept",
            {},
            headers=HEADERS_USER2,
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "accepted"

        # Check alliance now has 2 members
        resp3 = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp3.json()["member_count"] == 2

    @pytest.mark.asyncio
    async def test_decline_invitation(self):
        """User2 declines invitation → status becomes declined, NOT in alliance."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # Create invitation
        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        invitation_id = resp.json()["id"]

        # Decline invitation
        resp2 = await execute_post_request(
            f"{ENDPOINT}/invitations/{invitation_id}/decline",
            {},
            headers=HEADERS_USER2,
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "declined"

        # Alliance still has 1 member
        resp3 = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp3.json()["member_count"] == 1

    @pytest.mark.asyncio
    async def test_cannot_accept_other_users_invitation(self):
        """User1 cannot accept an invitation meant for User2."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        invitation_id = resp.json()["id"]

        # User1 tries to accept (it's user2's invitation)
        resp2 = await execute_post_request(
            f"{ENDPOINT}/invitations/{invitation_id}/accept",
            {},
            headers=HEADERS_USER1,
        )
        assert resp2.status_code == 403

    @pytest.mark.asyncio
    async def test_accept_nonexistent_invitation(self):
        await _setup_2_users()
        resp = await execute_post_request(
            f"{ENDPOINT}/invitations/{uuid.uuid4()}/accept",
            {},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404


# =========================================================================
# DELETE /alliances/{id}/invitations/{inv_id}  (cancel invitation)
# =========================================================================


class TestCancelInvitation:
    @pytest.mark.asyncio
    async def test_owner_can_cancel_invitation(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        invitation_id = resp.json()["id"]

        # Owner cancels
        resp2 = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/invitations/{invitation_id}",
            headers=HEADERS_USER1,
        )
        assert resp2.status_code == 200

    @pytest.mark.asyncio
    async def test_regular_member_cannot_cancel_invitation(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        free_acc = await push_game_account(user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        invitation_id = resp.json()["id"]

        # Regular member (user2) tries to cancel → 403
        resp2 = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/invitations/{invitation_id}",
            headers=HEADERS_USER2,
        )
        assert resp2.status_code == 403


# =========================================================================
# GET /alliances/{id}/invitations  (list alliance invitations)
# =========================================================================


class TestAllianceInvitations:
    @pytest.mark.asyncio
    async def test_owner_can_list_invitations(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )

        resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/invitations", headers=HEADERS_USER1
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_regular_member_cannot_list_invitations(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/invitations", headers=HEADERS_USER2
        )
        assert resp.status_code == 403


# =========================================================================
# DELETE /alliances/{id}/members/{ga_id}  (remove member)  — ACCESS CONTROL
# =========================================================================


class TestRemoveMember:
    @pytest.mark.asyncio
    async def test_owner_can_remove_regular_member(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{member.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_remove_officer(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{member.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_can_remove_regular_member(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        # Add a third user as regular member
        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        regular = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{regular.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_cannot_remove_another_officer(self):
        """Key access control test: officers must not remove other officers."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        officer1_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer1_acc)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        officer2_acc = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)
        await push_officer(alliance, officer2_acc)

        # officer1 (user2) tries to remove officer2
        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{officer2_acc.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_member_cannot_remove(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        target = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{target.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_remove_owner(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{owner.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 400


# =========================================================================
# POST /alliances/{id}/officers  (add officer — owner only)
# =========================================================================


class TestAddOfficer:
    @pytest.mark.asyncio
    async def test_owner_can_add_officer(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/officers",
            {"game_account_id": str(member.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_officer_cannot_add_officer(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email=USER3_EMAIL)
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        regular = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/officers",
            {"game_account_id": str(regular.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /alliances/{id}/officers  (remove officer — owner only)
# =========================================================================


class TestRemoveOfficer:
    @pytest.mark.asyncio
    async def test_owner_can_remove_officer(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/officers",
            headers=HEADERS_USER1,
            payload={"game_account_id": str(member.id)},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_cannot_remove_officer(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/officers",
            headers=HEADERS_USER2,
            payload={"game_account_id": str(officer_acc.id)},
        )
        assert response.status_code == 403


# =========================================================================
# PATCH /alliances/{id}/members/{ga_id}/group  (set group)
# =========================================================================


class TestSetMemberGroup:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "group",
        [1, 2, 3, None],
        ids=["group_1", "group_2", "group_3", "remove_group"],
    )
    async def test_owner_can_set_group(self, session, group):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/members/{member.id}/group",
            {"group": group},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_regular_member_cannot_set_group(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/members/{member.id}/group",
            {"group": 1},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# GET /alliances/my-roles
# =========================================================================


class TestGetMyRoles:
    @pytest.mark.asyncio
    async def test_my_roles_owner(self):
        """Owner of an alliance → is_owner=True, can_manage=True."""
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(f"{ENDPOINT}/my-roles", headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        assert str(alliance.id) in body["roles"]
        role = body["roles"][str(alliance.id)]
        assert role["is_owner"] is True
        assert role["can_manage"] is True
        assert str(owner.id) in body["my_account_ids"]

    @pytest.mark.asyncio
    async def test_my_roles_officer(self):
        """Officer of an alliance → is_officer=True, can_manage=True, is_owner=False."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        response = await execute_get_request(f"{ENDPOINT}/my-roles", headers=HEADERS_USER2)
        assert response.status_code == 200
        body = response.json()
        role = body["roles"][str(alliance.id)]
        assert role["is_owner"] is False
        assert role["is_officer"] is True
        assert role["can_manage"] is True

    @pytest.mark.asyncio
    async def test_my_roles_regular_member(self):
        """Regular member → is_owner=False, is_officer=False, can_manage=False."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(f"{ENDPOINT}/my-roles", headers=HEADERS_USER2)
        assert response.status_code == 200
        body = response.json()
        role = body["roles"][str(alliance.id)]
        assert role["is_owner"] is False
        assert role["is_officer"] is False
        assert role["can_manage"] is False

    @pytest.mark.asyncio
    async def test_my_roles_no_alliance(self):
        """User with no alliance → empty roles dict."""
        await _setup_2_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(f"{ENDPOINT}/my-roles", headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        assert body["roles"] == {}
        assert len(body["my_account_ids"]) == 1

    @pytest.mark.asyncio
    async def test_my_roles_without_auth(self):
        """No auth header → 401 (router-level dependency rejects)."""
        response = await execute_get_request(f"{ENDPOINT}/my-roles")
        assert response.status_code == 401


# =========================================================================
# Eligibility endpoints
# =========================================================================


class TestEligibility:
    @pytest.mark.asyncio
    async def test_eligible_owners(self):
        await _setup_2_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(f"{ENDPOINT}/eligible-owners", headers=HEADERS_USER1)
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_eligible_owners_empty_when_all_in_alliance(self):
        await _setup_2_users()
        await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(f"{ENDPOINT}/eligible-owners", headers=HEADERS_USER1)
        assert response.status_code == 200
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_eligible_members(self):
        await _setup_2_users()
        await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(f"{ENDPOINT}/eligible-members", headers=HEADERS_USER1)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_eligible_officers(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-officers", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_eligible_visitors_includes_free_account(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(free_acc.id) in ids

    @pytest.mark.asyncio
    async def test_eligible_visitors_includes_account_already_in_another_alliance(self):
        """Regression: accounts in another alliance must appear in eligible-visitors."""
        await _setup_2_users()
        alliance1, _ = await push_alliance_with_owner(user_id=USER_ID)
        _, owner_acc2 = await push_alliance_with_owner(
            user_id=USER2_ID,
            game_pseudo=GAME_PSEUDO_2,
            alliance_name="OtherAlliance",
            alliance_tag="OTA",
        )

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance1.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(owner_acc2.id) in ids

    @pytest.mark.asyncio
    async def test_eligible_visitors_excludes_own_members(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(member.id) not in ids

    @pytest.mark.asyncio
    async def test_eligible_visitors_excludes_existing_visitors(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        visitor_acc = await push_visitor(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(visitor_acc.id) not in ids

    @pytest.mark.asyncio
    async def test_eligible_visitors_excludes_pending_visitor_invite(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        candidate = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(candidate.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(candidate.id) not in ids

    @pytest.mark.asyncio
    async def test_eligible_visitors_empty_when_no_candidates(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/eligible-visitors", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_eligible_members_excludes_pending_invites(self):
        """GET /eligible-members must exclude accounts that already have a pending invitation (line 801)."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        candidate = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # Invite the candidate so it gets a pending invitation
        await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(candidate.id)},
            headers=HEADERS_USER1,
        )

        response = await execute_get_request(f"{ENDPOINT}/eligible-members", headers=HEADERS_USER1)
        assert response.status_code == 200
        ids = [a["id"] for a in response.json()]
        assert str(candidate.id) not in ids


# =========================================================================
# PATCH /alliances/{id}/elo  and  PATCH /alliances/{id}/tier
# =========================================================================


class TestAllianceEloTier:
    @pytest.mark.asyncio
    async def test_alliance_defaults_elo_zero_tier_twenty(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        resp = await execute_get_request(f"{ENDPOINT}/mine", headers=HEADERS_USER1)
        a = next(x for x in resp.json() if x["id"] == str(alliance.id))
        assert a["elo"] == 0
        assert a["tier"] == 20

    @pytest.mark.asyncio
    async def test_patch_elo_officer_success(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        resp = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/elo",
            payload={"elo": 2000},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 200
        assert resp.json()["elo"] == 2000

    @pytest.mark.asyncio
    async def test_patch_tier_officer_success(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        resp = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/tier",
            payload={"tier": 5},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 200
        assert resp.json()["tier"] == 5

    @pytest.mark.asyncio
    async def test_patch_elo_non_officer_forbidden(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        resp = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/elo",
            payload={"elo": 100},
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_elo_out_of_range_rejected(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        resp = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/elo",
            payload={"elo": 9999},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_tier_out_of_range_rejected(self):
        await _setup_2_users()
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        resp = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/tier",
            payload={"tier": 0},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 422


# =========================================================================
# GET /alliances/my-visited
# =========================================================================


class TestGetMyVisitedAlliances:
    @pytest.mark.asyncio
    async def test_my_visited_empty(self):
        await _setup_2_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        resp = await execute_get_request(f"{ENDPOINT}/my-visited", headers=HEADERS_USER1)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_my_visited_returns_visited_alliance(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_visitor(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_get_request(f"{ENDPOINT}/my-visited", headers=HEADERS_USER2)
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert str(alliance.id) in ids


# =========================================================================
# 404 paths — alliance not found
# =========================================================================


class TestAllianceNotFound:
    FAKE_ID = uuid.uuid4()

    @pytest.mark.asyncio
    async def test_update_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_put_request(
            f"{ENDPOINT}/{self.FAKE_ID}",
            {"name": "NotFound", "tag": "NF", "owner_id": str(uuid.uuid4())},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_delete_request(f"{ENDPOINT}/{self.FAKE_ID}", headers=HEADERS_USER1)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_invite_member_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_post_request(
            f"{ENDPOINT}/{self.FAKE_ID}/invitations",
            {"game_account_id": str(uuid.uuid4())},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_invitation_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_delete_request(
            f"{ENDPOINT}/{self.FAKE_ID}/invitations/{uuid.uuid4()}",
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_member_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_delete_request(
            f"{ENDPOINT}/{self.FAKE_ID}/members/{uuid.uuid4()}",
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_add_officer_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_post_request(
            f"{ENDPOINT}/{self.FAKE_ID}/officers",
            {"game_account_id": str(uuid.uuid4())},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_officer_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_delete_request(
            f"{ENDPOINT}/{self.FAKE_ID}/officers",
            headers=HEADERS_USER1,
            payload={"game_account_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_elo_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_patch_request(
            f"{ENDPOINT}/{self.FAKE_ID}/elo",
            {"elo": 100},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_tier_alliance_not_found(self):
        await _setup_2_users()
        resp = await execute_patch_request(
            f"{ENDPOINT}/{self.FAKE_ID}/tier",
            {"tier": 10},
            headers=HEADERS_USER1,
        )
        assert resp.status_code == 404


# =========================================================================
# require_visitor — 403 for total stranger (lines 93-99, 186, 252-264)
# =========================================================================


class TestRequireVisitor:
    @pytest.mark.asyncio
    async def test_non_member_non_visitor_forbidden_on_defense(self):
        """
        GET /alliances/{id}/defense/bg/1 calls require_visitor.
        A user who is neither a member nor a visitor must get 403.
        Covers: is_member (lines 93-99), is_owner (line 186), require_visitor (lines 702-711 via is_visitor).
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        # USER2 has no account in any alliance
        await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1",
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_visitor_allowed_on_defense(self):
        """
        A visitor account can access GET /alliances/{id}/defense/bg/1.
        Covers: is_visitor returning True via AllianceVisitorService.
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_visitor(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1",
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 200


# =========================================================================
# get_user_account_in_alliance — 403 when not a member (line 70)
# =========================================================================


class TestGetUserAccountInAlliance:
    @pytest.mark.asyncio
    async def test_non_member_cannot_place_defense(self):
        """
        POST /alliances/{id}/defense/bg/1/place calls get_user_account_in_alliance.
        A user with no account in the alliance must get 403 (line 70).
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        # USER2 has a game account but NOT in this alliance
        await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/place",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_user_id": str(uuid.uuid4()),
                "node_number": 1,
            },
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 403


# =========================================================================
# delete_alliance with officers — covers loop at line 509
# =========================================================================


class TestDeleteAllianceWithOfficers:
    @pytest.mark.asyncio
    async def test_delete_alliance_that_has_officers(self):
        """
        DELETE /alliances/{id} when the alliance has officers must delete the officer rows too.
        Covers the officer deletion loop at line 509.
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)

        resp = await execute_delete_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp.status_code == 204

        # Alliance must be gone
        resp2 = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp2.status_code == 404


# =========================================================================
# get_my_alliances — returns [] when user has no alliance (line 397)
# =========================================================================


class TestGetMyAlliancesEmpty:
    @pytest.mark.asyncio
    async def test_get_mine_returns_empty_for_user_without_alliance(self):
        """
        GET /alliances/mine for a user with a game account but no alliance
        must return an empty list (line 397 early-return path).
        """
        await _setup_2_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        resp = await execute_get_request(f"{ENDPOINT}/mine", headers=HEADERS_USER1)
        assert resp.status_code == 200
        assert resp.json() == []


# =========================================================================
# get_user_visitor_account — 403 when not a visitor (line 729)
# =========================================================================


class TestLeaveAsVisitor:
    @pytest.mark.asyncio
    async def test_non_visitor_cannot_leave_as_visitor(self):
        """
        DELETE /alliances/{id}/visitors/me calls get_user_visitor_account.
        A user who is not a visitor must get 403 (line 729).
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        # USER2 is a plain member, not a visitor
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/me",
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_visitor_can_leave(self):
        """
        DELETE /alliances/{id}/visitors/me for an actual visitor returns 204.
        Also covers the success path of get_user_visitor_account.
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_visitor(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/me",
            headers=HEADERS_USER2,
        )
        assert resp.status_code == 204
