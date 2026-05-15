"""Integration tests for alliance invitation endpoints."""

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
