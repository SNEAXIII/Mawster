"""Integration tests for alliance member endpoints."""

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
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
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
