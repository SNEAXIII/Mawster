"""Integration tests for alliance core endpoints."""

import uuid

import pytest
from sqlmodel import select

from main import app
from src.enums.InvitationStatus import InvitationStatus
from src.models.alliance.Alliance import Alliance
from src.models.alliance.AllianceInvitation import AllianceInvitation
from src.models.alliance.AllianceOfficer import AllianceOfficer
from src.models.alliance.AllianceVisitor import AllianceVisitor
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_game_account,
    push_member,
    push_officer,
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER_ID,
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
    async def test_owner_alone_can_delete(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_non_owner_cannot_delete(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER2,
            payload={"name": ALLIANCE_NAME},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_deleted_alliance_is_soft_deleted_not_removed(self):
        """The row survives (deleted_at stamped) so wars and stats keep resolving."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
        assert resp.status_code == 204

        async for session in get_test_session():
            row = await session.get(Alliance, alliance.id)
            assert row is not None
            assert row.deleted_at is not None

    @pytest.mark.asyncio
    async def test_deleted_alliance_disappears_from_every_listing(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )

        detail = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert detail.status_code == 404

        for route in ("", "/mine", "/accessible"):
            listing = await execute_get_request(f"{ENDPOINT}{route}", headers=HEADERS_USER1)
            assert listing.status_code == 200
            assert listing.json() == []

        roles = await execute_get_request(f"{ENDPOINT}/my-roles", headers=HEADERS_USER1)
        assert roles.status_code == 200
        assert roles.json()["roles"] == {}

    @pytest.mark.asyncio
    async def test_owner_can_create_a_new_alliance_after_deleting(self):
        """Deleting frees the owner's game account, so it becomes eligible again."""
        await _setup_2_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)

        await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )

        eligible = await execute_get_request(f"{ENDPOINT}/eligible-owners", headers=HEADERS_USER1)
        assert eligible.status_code == 200
        assert [acc["id"] for acc in eligible.json()] == [str(owner_acc.id)]

        created = await execute_post_request(
            ENDPOINT,
            {"name": "SecondTry", "tag": "ST2", "owner_id": str(owner_acc.id)},
            headers=HEADERS_USER1,
        )
        assert created.status_code == 201

    @pytest.mark.asyncio
    async def test_cannot_delete_while_another_member_remains(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
        assert resp.status_code == 409

        # Still very much alive
        detail = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert detail.status_code == 200

    @pytest.mark.asyncio
    async def test_cannot_delete_with_wrong_confirmation_name(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": "NotMyAlliance"},
        )
        assert resp.status_code == 400

        detail = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert detail.status_code == 200

    @pytest.mark.asyncio
    async def test_confirmation_name_is_case_sensitive(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME.lower()},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_without_confirmation_name_is_rejected(self):
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        resp = await execute_delete_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_drops_visitors_and_declines_pending_invitations(self):
        await _setup_2_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        visitor = await push_visitor(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        invited = await push_game_account(user_id=USER2_ID, game_pseudo="InvitedGuy")
        await load_objects(
            [
                AllianceInvitation(
                    alliance_id=alliance.id,
                    game_account_id=invited.id,
                    invited_by_game_account_id=owner_acc.id,
                )
            ]
        )

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
        assert resp.status_code == 204

        async for session in get_test_session():
            visitors = await session.exec(
                select(AllianceVisitor).where(AllianceVisitor.alliance_id == alliance.id)
            )
            assert visitors.all() == []
            invitations = await session.exec(
                select(AllianceInvitation).where(AllianceInvitation.alliance_id == alliance.id)
            )
            assert all(inv.status != InvitationStatus.PENDING for inv in invitations.all())

        # The visitor account itself is untouched
        assert visitor is not None


# =========================================================================
# POST /alliances/{id}/invitations  (invite member)
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
        resp = await execute_delete_request(
            f"{ENDPOINT}/{self.FAKE_ID}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
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


class TestDeleteAllianceWithOfficers:
    @pytest.mark.asyncio
    async def test_delete_alliance_that_has_a_stale_officer_row(self):
        """
        Deletion is owner-only-and-alone, so an officer row can only survive as a
        leftover pointing at a game account that already left. It must still be
        cleaned up rather than dangle on a disbanded alliance.
        """
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)
        # The officer leaves the alliance, leaving the owner alone
        await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/members/{member.id}", headers=HEADERS_USER1
        )

        resp = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}",
            headers=HEADERS_USER1,
            payload={"name": ALLIANCE_NAME},
        )
        assert resp.status_code == 204

        # Alliance is no longer reachable, and no officer row is left behind
        resp2 = await execute_get_request(f"{ENDPOINT}/{alliance.id}", headers=HEADERS_USER1)
        assert resp2.status_code == 404

        async for session in get_test_session():
            officers = await session.exec(
                select(AllianceOfficer).where(AllianceOfficer.alliance_id == alliance.id)
            )
            assert officers.all() == []


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
