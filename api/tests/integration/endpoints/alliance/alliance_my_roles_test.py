"""Integration tests for GET /alliances/my-roles — roles_by_account field."""

import pytest

from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import (
    DISCORD_ID_2,
    GAME_PSEUDO_2,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER_ID,
)
from tests.utils.utils_db import load_objects

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))

ENDPOINT = "/alliances/my-roles"


async def _setup_two_users():
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


class TestGetMyRolesRolesByAccount:
    @pytest.mark.asyncio
    async def test_no_accounts_returns_empty(self):
        await load_objects([get_generic_user(is_base_id=True)])
        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        assert body["roles"] == {}
        assert body["roles_by_account"] == {}
        assert body["my_account_ids"] == []

    @pytest.mark.asyncio
    async def test_owner_account_is_marked_as_owner(self):
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        acc_id = str(owner_acc.id)
        assert acc_id in body["roles_by_account"]
        entry = body["roles_by_account"][acc_id]
        assert entry["is_owner"] is True
        assert entry["is_officer"] is False
        assert entry["can_manage"] is True
        # backward-compat: roles keyed by alliance_id still present
        assert str(alliance.id) in body["roles"]

    @pytest.mark.asyncio
    async def test_member_account_has_no_elevated_role(self):
        await _setup_two_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member_acc = await push_member(alliance=alliance, user_id=USER2_ID)
        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER2)
        assert response.status_code == 200
        body = response.json()
        acc_id = str(member_acc.id)
        assert acc_id in body["roles_by_account"]
        entry = body["roles_by_account"][acc_id]
        assert entry["is_owner"] is False
        assert entry["is_officer"] is False
        assert entry["can_manage"] is False

    @pytest.mark.asyncio
    async def test_officer_account_is_marked_as_officer(self):
        await _setup_two_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance=alliance, user_id=USER2_ID)
        await push_officer(alliance=alliance, game_account=officer_acc)
        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER2)
        assert response.status_code == 200
        body = response.json()
        acc_id = str(officer_acc.id)
        entry = body["roles_by_account"][acc_id]
        assert entry["is_officer"] is True
        assert entry["is_owner"] is False
        assert entry["can_manage"] is True

    @pytest.mark.asyncio
    async def test_two_accounts_same_alliance_get_individual_roles(self):
        """Regression: two accounts of the same user in the same alliance must not share roles."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
        member_acc = await push_member(
            alliance=alliance, user_id=USER_ID, game_pseudo=GAME_PSEUDO_2
        )
        response = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        rba = body["roles_by_account"]
        owner_entry = rba[str(owner_acc.id)]
        member_entry = rba[str(member_acc.id)]
        assert owner_entry["is_owner"] is True
        assert member_entry["is_owner"] is False
        assert member_entry["is_officer"] is False
        assert member_entry["can_manage"] is False

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self):
        response = await execute_get_request(ENDPOINT)
        assert response.status_code == 401
