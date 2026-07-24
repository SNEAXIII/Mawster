"""Integration tests for /champion-users/upgrade-requests endpoints (create, list by account, cancel)."""

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.models.ChampionUser import ChampionUser
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_game_account,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
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
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)

CHAMPION_USERS_ROUTE = "/champion-users"
UPGRADE_REQUESTS_ROUTE = f"{CHAMPION_USERS_ROUTE}/upgrade-requests"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _push_champion_user(
    game_account_id: uuid.UUID,
    champion_id: uuid.UUID,
    rarity: str = "6r4",
    signature: int = 0,
) -> ChampionUser:
    stars = int(rarity.split("r", maxsplit=1)[0])
    rank = int(rarity.split("r")[1])
    entry = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=game_account_id,
        champion_id=champion_id,
        stars=stars,
        rank=rank,
        signature=signature,
    )
    await load_objects([entry])
    return entry


# =========================================================================
# Upgrade Request endpoints
# =========================================================================


class TestCreateUpgradeRequest:
    """POST /champion-users/upgrade-requests"""

    @pytest.mark.asyncio
    async def test_self_upgrade_request_ok(self):
        """Owner creates an upgrade request for their own champion."""
        await push_one_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["champion_user_id"] == str(entry.id)
        assert body["requested_rarity"] == "7r1"

    @pytest.mark.asyncio
    async def test_officer_upgrade_request_for_member(self):
        """Alliance officer creates upgrade request for a member's champion."""
        await push_one_user()
        await push_user2()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        await push_officer(alliance, owner_acc)
        member_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await push_champion()
        entry = await _push_champion_user(member_acc.id, champ.id, "6r4")

        response = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_non_officer_for_other_returns_403(self):
        """A regular member cannot create upgrade requests for another member."""
        await push_one_user()
        await push_user2()
        alliance, _owner = await push_alliance_with_owner(
            user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2
        )
        # USER_ID is just a member, not officer
        await push_member(alliance, user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        champ = await push_champion()
        entry = await _push_champion_user(_owner.id, champ.id, "6r4")

        response = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_champion_user_not_found_returns_404(self):
        await push_one_user()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(uuid.uuid4()),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_second_request_different_rarity_updates_in_place(self):
        """Targeting another rarity for the same champion updates the pending request
        instead of creating a second one."""
        await push_one_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        first = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={"champion_user_id": str(entry.id), "requested_rarity": "7r1"},
            headers=HEADERS,
        )
        assert first.status_code == 201

        second = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={"champion_user_id": str(entry.id), "requested_rarity": "7r2"},
            headers=HEADERS,
        )
        assert second.status_code == 201
        # Same underlying request, retargeted — not a new row.
        assert second.json()["id"] == first.json()["id"]
        assert second.json()["requested_rarity"] == "7r2"

        listing = await execute_get_request(
            f"{UPGRADE_REQUESTS_ROUTE}/by-account/{acc.id}", headers=HEADERS
        )
        body = listing.json()
        assert len(body) == 1
        assert body[0]["requested_rarity"] == "7r2"

    @pytest.mark.asyncio
    async def test_second_request_same_rarity_returns_409(self):
        """Re-requesting the rarity that is already pending is a conflict."""
        await push_one_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        first = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={"champion_user_id": str(entry.id), "requested_rarity": "7r1"},
            headers=HEADERS,
        )
        assert first.status_code == 201

        second = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={"champion_user_id": str(entry.id), "requested_rarity": "7r1"},
            headers=HEADERS,
        )
        assert second.status_code == 409


class TestGetUpgradeRequestsByAccount:
    """GET /champion-users/upgrade-requests/by-account/{game_account_id}"""

    @pytest.mark.asyncio
    async def test_get_own_upgrade_requests(self):
        """Owner can see pending upgrade requests for their own account."""
        await push_one_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        # Create an upgrade request first
        await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )

        response = await execute_get_request(
            f"{UPGRADE_REQUESTS_ROUTE}/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["requested_rarity"] == "7r1"

    @pytest.mark.asyncio
    async def test_ally_can_view_upgrade_requests(self):
        """An alliance member can view upgrade requests for another member."""
        await push_one_user()
        await push_user2()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        member_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await push_champion()
        entry = await _push_champion_user(member_acc.id, champ.id, "6r4")

        # Create upgrade request as owner (officer)
        await push_officer(alliance, owner_acc)
        await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )

        # Owner (in same alliance) can view member's upgrade requests
        response = await execute_get_request(
            f"{UPGRADE_REQUESTS_ROUTE}/by-account/{member_acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_non_ally_cannot_view_upgrade_requests(self):
        """A user NOT in the same alliance cannot view upgrade requests."""
        await push_one_user()
        await push_user2()
        _, _owner = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        # USER_ID is not in this alliance at all
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(
            f"{UPGRADE_REQUESTS_ROUTE}/by-account/{_owner.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_account_not_found_returns_404(self):
        await push_one_user()

        response = await execute_get_request(
            f"{UPGRADE_REQUESTS_ROUTE}/by-account/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404


class TestCancelUpgradeRequest:
    """DELETE /champion-users/upgrade-requests/{request_id}"""

    @pytest.mark.asyncio
    async def test_officer_can_cancel(self):
        """An officer/owner can cancel an upgrade request."""
        await push_one_user()
        await push_user2()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        await push_officer(alliance, owner_acc)
        member_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await push_champion()
        entry = await _push_champion_user(member_acc.id, champ.id, "6r4")

        # Create upgrade request
        create_resp = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=HEADERS,
        )
        assert create_resp.status_code == 201
        request_id = create_resp.json()["id"]

        # Cancel it
        response = await execute_delete_request(
            f"{UPGRADE_REQUESTS_ROUTE}/{request_id}", headers=HEADERS
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_non_officer_cannot_cancel(self):
        """A regular member cannot cancel an upgrade request."""
        await push_one_user()
        await push_user2()
        # USER2 owns the alliance, USER1 is just a member
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2
        )
        await push_officer(alliance, owner_acc)
        member_acc = await push_member(alliance, user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await push_champion()
        entry = await _push_champion_user(member_acc.id, champ.id, "6r4")

        # Create upgrade request as USER2 (officer)
        headers_user2 = create_auth_headers(user_id=str(USER2_ID))
        create_resp = await execute_post_request(
            UPGRADE_REQUESTS_ROUTE,
            payload={
                "champion_user_id": str(entry.id),
                "requested_rarity": "7r1",
            },
            headers=headers_user2,
        )
        assert create_resp.status_code == 201
        request_id = create_resp.json()["id"]

        # USER1 (regular member) tries to cancel → 403
        response = await execute_delete_request(
            f"{UPGRADE_REQUESTS_ROUTE}/{request_id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cancel_not_found_returns_404(self):
        await push_one_user()
        response = await execute_delete_request(
            f"{UPGRADE_REQUESTS_ROUTE}/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404
