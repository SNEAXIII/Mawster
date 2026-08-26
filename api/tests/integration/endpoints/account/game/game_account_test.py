"""Integration tests for /game-accounts endpoints."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlmodel import select

from main import app
from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType
from src.models.alliance.AllianceInvitation import AllianceInvitation
from src.models.Base import utcnow
from src.services.account.game.GameAccountService import (
    MAX_GAME_ACCOUNTS_PER_USER,
    RESTORE_WINDOW_DAYS,
)
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_game_account,
    push_member,
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import (
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_ID,
    USER_ID,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()
ENDPOINT = "/game-accounts"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup_1_user():
    """Insert the standard test user."""
    await push_one_user()


# =========================================================================
# POST /game-accounts
# =========================================================================


class TestCreateGameAccount:
    @pytest.mark.asyncio
    async def test_create_ok(self):
        await _setup_1_user()
        payload = {"game_pseudo": GAME_PSEUDO, "is_primary": True}
        response = await execute_post_request(ENDPOINT, payload, headers=HEADERS)
        assert response.status_code == 201
        body = response.json()
        assert body["game_pseudo"] == GAME_PSEUDO
        assert body["is_primary"] is True

    @pytest.mark.asyncio
    async def test_create_without_auth_returns_401(self):
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": GAME_PSEUDO, "is_primary": False},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_exceeds_limit(self):
        await _setup_1_user()
        # Create 10 accounts
        for i in range(10):
            await push_game_account(user_id=USER_ID, game_pseudo=f"Player{i}")

        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "Player11", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"is_primary": True},
        ],
        ids=["empty_body", "missing_pseudo"],
    )
    async def test_create_invalid_payload(self, session, payload):
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            payload,
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pseudo_too_long_returns_422(self):
        """game_pseudo has max_length=16 in DTO."""
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "A" * 17, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pseudo_exactly_16_chars_ok(self):
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "A" * 16, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_response_body_structure(self):
        """Verify all expected fields are present in the response."""
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": GAME_PSEUDO, "is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        required_fields = {"id", "user_id", "game_pseudo", "is_primary", "created_at"}
        assert required_fields.issubset(body.keys())
        assert body["user_id"] == str(USER_ID)

    @pytest.mark.asyncio
    async def test_create_multiple_primary_keeps_latest(self):
        """Creating multiple primary accounts should succeed."""
        await _setup_1_user()
        r1 = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "First", "is_primary": True},
            headers=HEADERS,
        )
        assert r1.status_code == 201
        r2 = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "Second", "is_primary": True},
            headers=HEADERS,
        )
        assert r2.status_code == 201


# =========================================================================
# GET /game-accounts
# =========================================================================


class TestGetMyGameAccounts:
    @pytest.mark.asyncio
    async def test_list_empty(self):
        await _setup_1_user()
        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_own_accounts(self):
        await _setup_1_user()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2

    @pytest.mark.asyncio
    async def test_list_sorted_primary_first(self):
        """Primary accounts should appear before non-primary."""
        await _setup_1_user()
        await push_game_account(user_id=USER_ID, game_pseudo="NonPrimary", is_primary=False)
        await push_game_account(user_id=USER_ID, game_pseudo="Primary", is_primary=True)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body[0]["is_primary"] is True
        assert body[0]["game_pseudo"] == "Primary"

    @pytest.mark.asyncio
    async def test_list_includes_alliance_tag(self):
        """Accounts that are in an alliance should return alliance_tag and alliance_name."""
        await _setup_1_user()
        await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        # Also add a free account
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        # Find the one in alliance
        in_alliance = [a for a in body if a["alliance_id"] is not None]
        free = [a for a in body if a["alliance_id"] is None]
        assert len(in_alliance) == 1
        assert in_alliance[0]["alliance_tag"] is not None
        assert in_alliance[0]["alliance_name"] is not None
        assert len(free) == 1
        assert free[0]["alliance_tag"] is None

    @pytest.mark.asyncio
    async def test_does_not_return_other_users_accounts(self):
        """A user should not see another user's accounts."""
        await _setup_1_user()
        await push_user2()
        await push_game_account(user_id=USER2_ID, game_pseudo="OtherPlayer")

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        assert len(response.json()) == 0


# =========================================================================
# GET /game-accounts/{id}
# =========================================================================


class TestGetSingleGameAccount:
    @pytest.mark.asyncio
    async def test_get_own_account(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == GAME_PSEUDO

    @pytest.mark.asyncio
    async def test_get_other_users_account_returns_403(self):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_get_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self):
        await _setup_1_user()
        response = await execute_get_request(f"/game-accounts/{uuid.uuid4()}", headers=HEADERS)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(self):
        """A non-UUID path param should be rejected by FastAPI validation."""
        await _setup_1_user()
        response = await execute_get_request("/game-accounts/not-a-uuid", headers=HEADERS)
        assert response.status_code == 422


# =========================================================================
# PUT /game-accounts/{id}
# =========================================================================


class TestUpdateGameAccount:
    @pytest.mark.asyncio
    async def test_update_ok(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "NewPseudo", "is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == "NewPseudo"
        assert response.json()["is_primary"] is True

    @pytest.mark.asyncio
    async def test_update_other_users_account_returns_403(self):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "Hacked", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self):
        await _setup_1_user()
        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "XX", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_pseudo_too_long_returns_422(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "X" * 51, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_missing_pseudo_returns_422(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_invalid_uuid_returns_422(self):
        await _setup_1_user()
        response = await execute_put_request(
            "/game-accounts/not-a-uuid",
            {"game_pseudo": "X", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_without_auth_returns_401(self):
        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "X", "is_primary": False},
        )
        assert response.status_code == 401


# =========================================================================
# DELETE /game-accounts/{id}
# =========================================================================


class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_ok(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_other_users_account_returns_403(self):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self):
        await _setup_1_user()
        response = await execute_delete_request(f"/game-accounts/{uuid.uuid4()}", headers=HEADERS)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_422(self):
        await _setup_1_user()
        response = await execute_delete_request("/game-accounts/not-valid", headers=HEADERS)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_without_auth_returns_401(self):
        response = await execute_delete_request(f"/game-accounts/{uuid.uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_already_deleted_returns_404(self):
        """Re-deleting the same account should 404."""
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        r1 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r1.status_code == 204
        r2 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_account_in_alliance(self):
        """Deleting an alliance-owner game account returns 409."""
        await _setup_1_user()
        _, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_delete_request(f"/game-accounts/{owner_acc.id}", headers=HEADERS)
        assert response.status_code == 409


# =========================================================================
# Soft delete: the account survives, hidden, for RESTORE_WINDOW_DAYS
# =========================================================================


class TestSoftDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_deleted_account_disappears_from_the_list(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_deleted_account_is_not_readable_anymore(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        response = await execute_get_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_deleted_account_cannot_be_updated(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        payload = {"game_pseudo": "Renamed", "is_primary": False}
        response = await execute_put_request(f"/game-accounts/{acc.id}", payload, headers=HEADERS)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_hands_the_primary_flag_over(self):
        """The primary flag belongs to a live account: it moves on deletion."""
        await _setup_1_user()
        primary = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO, is_primary=True)
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(f"/game-accounts/{primary.id}", headers=HEADERS)
        assert response.status_code == 204

        remaining = (await execute_get_request(ENDPOINT, headers=HEADERS)).json()
        assert len(remaining) == 1
        assert remaining[0]["game_pseudo"] == GAME_PSEUDO_2
        assert remaining[0]["is_primary"] is True

    @pytest.mark.asyncio
    async def test_delete_account_member_of_an_alliance_returns_409(self):
        """A member must leave their alliance before deleting the account."""
        await _setup_1_user()
        await push_user2()
        alliance, _ = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Owner")
        member = await push_member(alliance=alliance, user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_delete_request(f"/game-accounts/{member.id}", headers=HEADERS)
        assert response.status_code == 409


# =========================================================================
# GET /game-accounts/deleted
# =========================================================================


class TestListDeletedGameAccounts:
    ENDPOINT_DELETED = "/game-accounts/deleted"

    @pytest.mark.asyncio
    async def test_lists_deleted_accounts_with_their_deadline(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        response = await execute_get_request(self.ENDPOINT_DELETED, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["id"] == str(acc.id)
        assert body[0]["game_pseudo"] == GAME_PSEUDO
        deleted_at = datetime.fromisoformat(body[0]["deleted_at"])
        restorable_until = datetime.fromisoformat(body[0]["restorable_until"])
        assert restorable_until - deleted_at == timedelta(days=RESTORE_WINDOW_DAYS)

    @pytest.mark.asyncio
    async def test_live_accounts_are_not_listed(self):
        await _setup_1_user()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(self.ENDPOINT_DELETED, headers=HEADERS)
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_expired_accounts_are_not_listed(self):
        """Past the restore window the account is lost for the player."""
        await _setup_1_user()
        await push_game_account(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            deleted_at=utcnow() - timedelta(days=RESTORE_WINDOW_DAYS, hours=1),
        )

        response = await execute_get_request(self.ENDPOINT_DELETED, headers=HEADERS)
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_other_users_deleted_accounts_are_not_listed(self):
        await _setup_1_user()
        await push_user2()
        await push_game_account(
            user_id=USER2_ID, game_pseudo="Other", deleted_at=utcnow() - timedelta(hours=1)
        )

        response = await execute_get_request(self.ENDPOINT_DELETED, headers=HEADERS)
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_without_auth_returns_401(self):
        response = await execute_get_request(self.ENDPOINT_DELETED)
        assert response.status_code == 401


# =========================================================================
# POST /game-accounts/{id}/restore
# =========================================================================


class TestRestoreGameAccount:
    @staticmethod
    def _route(account_id) -> str:
        return f"/game-accounts/{account_id}/restore"

    @pytest.mark.asyncio
    async def test_restore_ok(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == GAME_PSEUDO

        listed = (await execute_get_request(ENDPOINT, headers=HEADERS)).json()
        assert [a["id"] for a in listed] == [str(acc.id)]

    @pytest.mark.asyncio
    async def test_restore_last_account_makes_it_primary_again(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO, is_primary=True)
        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["is_primary"] is True

    @pytest.mark.asyncio
    async def test_restore_keeps_an_existing_primary_untouched(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO, is_primary=True)
        await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2, is_primary=True)

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["is_primary"] is False

    @pytest.mark.asyncio
    async def test_restore_after_the_window_returns_410(self):
        await _setup_1_user()
        acc = await push_game_account(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            deleted_at=utcnow() - timedelta(days=RESTORE_WINDOW_DAYS, hours=1),
        )

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 410

    @pytest.mark.asyncio
    async def test_restore_a_live_account_returns_409(self):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_restore_other_users_account_returns_403(self):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(
            user_id=USER2_ID, game_pseudo="Other", deleted_at=utcnow() - timedelta(hours=1)
        )

        response = await execute_post_request(self._route(acc.id), {}, headers=HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_restore_nonexistent_returns_404(self):
        await _setup_1_user()
        response = await execute_post_request(self._route(uuid.uuid4()), {}, headers=HEADERS)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_restore_without_auth_returns_401(self):
        response = await execute_post_request(self._route(uuid.uuid4()), {})
        assert response.status_code == 401


# =========================================================================
# Quota: a restorable account keeps eating its slot
# =========================================================================


class TestQuotaWithDeletedAccounts:
    @pytest.mark.asyncio
    async def test_restorable_account_still_counts_in_the_quota(self):
        await _setup_1_user()
        for index in range(MAX_GAME_ACCOUNTS_PER_USER - 1):
            await push_game_account(user_id=USER_ID, game_pseudo=f"Acc{index}")
        deleted = await push_game_account(user_id=USER_ID, game_pseudo="Doomed")
        await execute_delete_request(f"/game-accounts/{deleted.id}", headers=HEADERS)

        response = await execute_post_request(
            ENDPOINT, {"game_pseudo": "OneTooMany", "is_primary": False}, headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_definitively_lost_account_frees_its_slot(self):
        await _setup_1_user()
        for index in range(MAX_GAME_ACCOUNTS_PER_USER - 1):
            await push_game_account(user_id=USER_ID, game_pseudo=f"Acc{index}")
        await push_game_account(
            user_id=USER_ID,
            game_pseudo="Lost",
            deleted_at=utcnow() - timedelta(days=RESTORE_WINDOW_DAYS, hours=1),
        )

        response = await execute_post_request(
            ENDPOINT, {"game_pseudo": "Replacement", "is_primary": False}, headers=HEADERS
        )
        assert response.status_code == 201


# =========================================================================
# Deletion vs. the account's alliance ties
# =========================================================================


async def _push_invitation(
    alliance_id,
    game_account_id,
    invited_by_game_account_id,
    status_: InvitationStatus = InvitationStatus.PENDING,
    type_: InvitationType = InvitationType.MEMBER,
) -> AllianceInvitation:
    invitation = AllianceInvitation(
        id=uuid.uuid4(),
        alliance_id=alliance_id,
        game_account_id=game_account_id,
        invited_by_game_account_id=invited_by_game_account_id,
        status=status_,
        type=type_,
    )
    await load_objects([invitation])
    return invitation


async def _invitation_exists(invitation_id) -> bool:
    async for session in get_test_session():
        result = await session.exec(
            select(AllianceInvitation).where(AllianceInvitation.id == invitation_id)
        )
        return result.first() is not None
    return None


class TestDeleteGameAccountAllianceTies:
    @pytest.mark.asyncio
    async def test_visitor_account_cannot_be_deleted(self):
        """Visiting an alliance blocks the deletion, exactly like being a member."""
        await _setup_1_user()
        await push_user2()
        alliance, _ = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Owner")
        visitor = await push_visitor(alliance=alliance, user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_delete_request(f"/game-accounts/{visitor.id}", headers=HEADERS)
        assert response.status_code == 409

        listed = (await execute_get_request(ENDPOINT, headers=HEADERS)).json()
        assert [acc["id"] for acc in listed] == [str(visitor.id)]

    @pytest.mark.asyncio
    async def test_delete_cancels_the_invitations_the_account_received(self):
        await _setup_1_user()
        await push_user2()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Owner")
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        invitation = await _push_invitation(alliance.id, acc.id, owner_acc.id)

        response = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 204
        assert await _invitation_exists(invitation.id) is False

    @pytest.mark.asyncio
    async def test_delete_cancels_the_invitations_the_account_sent(self):
        """An invite sent by the account goes too — nobody could cancel it afterwards."""
        await _setup_1_user()
        await push_user2()
        alliance, _ = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Owner")
        inviter = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        guest = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        invitation = await _push_invitation(alliance.id, guest.id, inviter.id)

        response = await execute_delete_request(f"/game-accounts/{inviter.id}", headers=HEADERS)
        assert response.status_code == 204
        assert await _invitation_exists(invitation.id) is False

    @pytest.mark.asyncio
    async def test_delete_leaves_answered_invitations_alone(self):
        """Only pending rows are cancelled: answered ones stay as history."""
        await _setup_1_user()
        await push_user2()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Owner")
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        declined = await _push_invitation(
            alliance.id, acc.id, owner_acc.id, status_=InvitationStatus.DECLINED
        )

        response = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert response.status_code == 204
        assert await _invitation_exists(declined.id) is True
