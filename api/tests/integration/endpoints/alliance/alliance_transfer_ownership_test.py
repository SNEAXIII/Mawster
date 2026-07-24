"""Integration tests for PATCH /alliances/{id}/owner (transfer ownership)."""

import uuid

import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_patch_request,
)
from tests.utils.utils_constant import (
    DISCORD_ID_2,
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


async def _setup_2_users():
    """Insert two standard test users."""
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


# =============================================================================
# PATCH /alliances/{id}/owner  (transfer ownership)
# =============================================================================


class TestTransferOwnership:
    @pytest.mark.asyncio
    async def test_owner_can_transfer_to_officer(self):
        """Owner transfers to an officer — roles swap correctly."""
        await _setup_2_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/owner",
            {"game_account_id": str(officer_acc.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200
        body = response.json()
        # New owner is the former officer
        assert body["owner_id"] == str(officer_acc.id)
        # Former owner is now in officers list
        officer_ids = [o["game_account_id"] for o in body["officers"]]
        assert str(owner_acc.id) in officer_ids
        # Former officer is no longer in officers list
        assert str(officer_acc.id) not in officer_ids

    @pytest.mark.asyncio
    async def test_non_owner_cannot_transfer(self):
        """A regular member or officer cannot initiate transfer."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        # officer_acc tries to transfer to themselves — must fail
        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/owner",
            {"game_account_id": str(officer_acc.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_transfer_to_plain_member(self):
        """Target must be an officer — plain member raises 403."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        plain_member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/owner",
            {"game_account_id": str(plain_member.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_transfer_unknown_alliance_returns_404(self):
        """Non-existent alliance returns 404."""
        await _setup_2_users()
        response = await execute_patch_request(
            f"{ENDPOINT}/{uuid.uuid4()}/owner",
            {"game_account_id": str(uuid.uuid4())},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_unauthenticated_transfer_returns_401(self):
        """No auth header → 401."""
        await _setup_2_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        response = await execute_patch_request(
            f"{ENDPOINT}/{alliance.id}/owner",
            {"game_account_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401
