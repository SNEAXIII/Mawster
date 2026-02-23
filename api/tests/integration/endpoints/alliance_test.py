"""Integration tests for /alliances endpoints — CRUD, members, officers, groups, access control."""
import uuid

import pytest

from main import app
from src.enums.Roles import Roles
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
    execute_put_request,
    execute_patch_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER_LOGIN,
    USER_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    GAME_PSEUDO_3,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(login=USER_LOGIN, user_id=str(USER_ID), email=USER_EMAIL)
HEADERS_USER2 = create_auth_headers(login=USER2_LOGIN, user_id=str(USER2_ID), email=USER2_EMAIL)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_users():
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
    async def test_create_ok(self, session):
        await _setup_users()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_post_request(
            "/alliances",
            {"name": ALLIANCE_NAME, "tag": ALLIANCE_TAG, "owner_id": str(acc.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == ALLIANCE_NAME
        assert body["tag"] == ALLIANCE_TAG
        assert body["member_count"] == 1

    @pytest.mark.asyncio
    async def test_create_without_auth(self, session):
        response = await execute_post_request(
            "/alliances",
            {"name": "X", "tag": "X", "owner_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("not_your_account", 403),
            ("already_in_alliance", 409),
            ("account_not_found", 404),
        ],
        ids=["not_your_account", "already_in_alliance", "account_not_found"],
    )
    async def test_create_errors(self, session, scenario, expected_status):
        await _setup_users()

        if scenario == "not_your_account":
            acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO)
            owner_id = str(acc.id)
        elif scenario == "already_in_alliance":
            alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
            owner_id = str(owner.id)
        else:
            owner_id = str(uuid.uuid4())

        response = await execute_post_request(
            "/alliances",
            {"name": "X", "tag": "X", "owner_id": owner_id},
            headers=HEADERS_USER1,
        )
        assert response.status_code == expected_status


# =========================================================================
# GET /alliances, /alliances/mine, /alliances/{id}
# =========================================================================


class TestGetAlliances:
    @pytest.mark.asyncio
    async def test_get_all(self, session):
        await _setup_users()
        await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request("/alliances", headers=HEADERS_USER1)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_get_mine(self, session):
        await _setup_users()
        await push_alliance_with_owner(user_id=USER_ID)
        # user2 creates another alliance — user1 should NOT see it in /mine
        await push_alliance_with_owner(
            user_id=USER2_ID, game_pseudo="U2Player", alliance_name="OtherAlliance", alliance_tag="OTH"
        )

        response = await execute_get_request("/alliances/mine", headers=HEADERS_USER1)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["name"] == ALLIANCE_NAME

    @pytest.mark.asyncio
    async def test_get_by_id(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(
            f"/alliances/{alliance.id}", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert response.json()["id"] == str(alliance.id)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, session):
        await _setup_users()
        response = await execute_get_request(
            f"/alliances/{uuid.uuid4()}", headers=HEADERS_USER1
        )
        assert response.status_code == 404


# =========================================================================
# PUT /alliances/{id}  (update)
# =========================================================================


class TestUpdateAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_update(self, session):
        await _setup_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_put_request(
            f"/alliances/{alliance.id}",
            {"name": "NewName", "tag": "NEW", "owner_id": str(owner.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "NewName"

    @pytest.mark.asyncio
    async def test_non_owner_cannot_update(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_put_request(
            f"/alliances/{alliance.id}",
            {"name": "Hacked", "tag": "H", "owner_id": str(uuid.uuid4())},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /alliances/{id}
# =========================================================================


class TestDeleteAlliance:
    @pytest.mark.asyncio
    async def test_owner_can_delete(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}", headers=HEADERS_USER1
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_non_owner_cannot_delete(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}", headers=HEADERS_USER2
        )
        assert response.status_code == 403


# =========================================================================
# POST /alliances/{id}/members  (add member)
# =========================================================================


class TestAddMember:
    @pytest.mark.asyncio
    async def test_owner_can_add_member(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        free_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"/alliances/{alliance.id}/members",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        assert response.json()["member_count"] >= 1

    @pytest.mark.asyncio
    async def test_officer_can_add_member(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        # Create a third user's free account
        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email="user3@gmail.com")
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        free_acc = await push_game_account(user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_post_request(
            f"/alliances/{alliance.id}/members",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_regular_member_cannot_add(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # user2 is a regular member, cannot add
        free_acc = await push_game_account(
            user_id=uuid.uuid4(), game_pseudo=GAME_PSEUDO_3
        )
        response = await execute_post_request(
            f"/alliances/{alliance.id}/members",
            {"game_account_id": str(free_acc.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_add_already_in_alliance(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"/alliances/{alliance.id}/members",
            {"game_account_id": str(member.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 409


# =========================================================================
# DELETE /alliances/{id}/members/{ga_id}  (remove member)  — ACCESS CONTROL
# =========================================================================


class TestRemoveMember:
    @pytest.mark.asyncio
    async def test_owner_can_remove_regular_member(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{member.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_remove_officer(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{member.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_can_remove_regular_member(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        # Add a third user as regular member
        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email="user3@gmail.com")
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        regular = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{regular.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_cannot_remove_another_officer(self, session):
        """Key access control test: officers must not remove other officers."""
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)

        officer1_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer1_acc)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email="user3@gmail.com")
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        officer2_acc = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)
        await push_officer(alliance, officer2_acc)

        # officer1 (user2) tries to remove officer2
        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{officer2_acc.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_member_cannot_remove(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email="user3@gmail.com")
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        target = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{target.id}",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_remove_owner(self, session):
        await _setup_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/members/{owner.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 400


# =========================================================================
# POST /alliances/{id}/officers  (add officer — owner only)
# =========================================================================


class TestAddOfficer:
    @pytest.mark.asyncio
    async def test_owner_can_add_officer(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"/alliances/{alliance.id}/officers",
            {"game_account_id": str(member.id)},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_officer_cannot_add_officer(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        u3_id = uuid.uuid4()
        u3 = get_generic_user(login="user3", email="user3@gmail.com")
        u3.id = u3_id
        u3.discord_id = "discord_789"
        await load_objects([u3])
        regular = await push_member(alliance, user_id=u3_id, game_pseudo=GAME_PSEUDO_3)

        response = await execute_post_request(
            f"/alliances/{alliance.id}/officers",
            {"game_account_id": str(regular.id)},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /alliances/{id}/officers  (remove officer — owner only)
# =========================================================================


class TestRemoveOfficer:
    @pytest.mark.asyncio
    async def test_owner_can_remove_officer(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, member)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/officers",
            headers=HEADERS_USER1,
            payload={"game_account_id": str(member.id)},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_officer_cannot_remove_officer(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        officer_acc = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)

        response = await execute_delete_request(
            f"/alliances/{alliance.id}/officers",
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
        await _setup_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_patch_request(
            f"/alliances/{alliance.id}/members/{member.id}/group",
            {"group": group},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_regular_member_cannot_set_group(self, session):
        await _setup_users()
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_patch_request(
            f"/alliances/{alliance.id}/members/{member.id}/group",
            {"group": 1},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


# =========================================================================
# Eligibility endpoints
# =========================================================================


class TestEligibility:
    @pytest.mark.asyncio
    async def test_eligible_owners(self, session):
        await _setup_users()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(
            "/alliances/eligible-owners", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_eligible_owners_empty_when_all_in_alliance(self, session):
        await _setup_users()
        await push_alliance_with_owner(user_id=USER_ID)

        response = await execute_get_request(
            "/alliances/eligible-owners", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_eligible_members(self, session):
        await _setup_users()
        await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            "/alliances/eligible-members", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_eligible_officers(self, session):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
        member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"/alliances/{alliance.id}/eligible-officers", headers=HEADERS_USER1
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
