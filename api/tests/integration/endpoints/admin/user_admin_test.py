"""Integration tests for /admin endpoints — user management with parametrized access control."""

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Base import utcnow
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    get_generic_user,
    push_one_admin,
    push_one_super_admin,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_request,
)
from tests.utils.utils_constant import (
    DISCORD_ID_2,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER_ID,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
SUPER_ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.SUPER_ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)

ADMIN_USERS_URL = "/admin/users"
ADMIN2_EMAIL = "admin2@gmail.com"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup_user(
    user_id=USER2_ID,
    login=USER2_LOGIN,
    email=USER2_EMAIL,
    discord_id=DISCORD_ID_2,
    disabled_at=None,
    deleted_at=None,
    role=Roles.USER,
):
    user = get_generic_user(
        login=login, email=email, role=role, disabled_at=disabled_at, deleted_at=deleted_at
    )
    user.id = user_id
    user.discord_id = discord_id
    await load_objects([user])
    return user


# =========================================================================
# Access control — 401 / 403 for all /admin/users routes
# =========================================================================

_FAKE_ID = str(uuid.uuid4())

_ADMIN_USER_ROUTES = [
    ("GET", ADMIN_USERS_URL, None, "list_users"),
    ("PATCH", f"/admin/users/disable/{_FAKE_ID}", {}, "disable"),
    ("PATCH", f"/admin/users/enable/{_FAKE_ID}", {}, "enable"),
    ("DELETE", f"/admin/users/delete/{_FAKE_ID}", None, "delete"),
    ("PATCH", f"/admin/users/promote/{_FAKE_ID}", {}, "promote"),
]


class TestAdminUsersAccessControl:
    """All /admin/users endpoints require authentication and admin role."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _ADMIN_USER_ROUTES],
        ids=[name for _, _, _, name in _ADMIN_USER_ROUTES],
    )
    async def test_no_auth_returns_401(self, session, method, url, payload):
        response = await execute_request(method, url, payload)
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _ADMIN_USER_ROUTES],
        ids=[name for _, _, _, name in _ADMIN_USER_ROUTES],
    )
    async def test_non_admin_returns_403(self, session, method, url, payload):
        response = await execute_request(method, url, payload, headers=USER_HEADERS)
        assert response.status_code == 403


# =========================================================================
# GET /admin/users
# =========================================================================


class TestGetUsers:
    @pytest.mark.asyncio
    async def test_admin_can_list_users(self):
        await push_one_admin()
        await _setup_user()

        response = await execute_get_request(ADMIN_USERS_URL, headers=ADMIN_HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body["total_users"] >= 2

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "page, size, expected_status",
        [
            (1, 10, 200),
            (0, 10, 422),
            (1, 0, 422),
        ],
        ids=["valid", "page_zero", "size_zero"],
    )
    async def test_pagination_validation(self, session, page, size, expected_status):
        await push_one_admin()
        response = await execute_get_request(
            f"/admin/users?page={page}&size={size}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_response_structure(self):
        await push_one_admin()
        await _setup_user()
        response = await execute_get_request(ADMIN_USERS_URL, headers=ADMIN_HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert "users" in body
        assert "total_users" in body
        assert "total_pages" in body
        assert "current_page" in body
        assert body["total_users"] >= 1


# =========================================================================
# PATCH /admin/users/disable/{uuid}
# =========================================================================


class TestDisableUser:
    @pytest.mark.asyncio
    async def test_disable_ok(self):
        await push_one_admin()
        user = await _setup_user()

        response = await execute_patch_request(
            f"/admin/users/disable/{user.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("already_disabled", 400),
            ("deleted", 400),
            ("is_admin", 400),
            ("not_found", 400),
        ],
        ids=["already_disabled", "deleted_user", "target_is_admin", "not_found"],
    )
    async def test_disable_errors(self, session, scenario, expected_status):
        await push_one_admin()

        if scenario == "already_disabled":
            user = await _setup_user(disabled_at=utcnow())
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=utcnow())
            target_id = user.id
        elif scenario == "is_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(),
                login="admin2",
                email=ADMIN2_EMAIL,
                discord_id="discord_admin2",
                role=Roles.ADMIN,
            )
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/disable/{target_id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_disable_invalid_uuid_returns_422(self):
        await push_one_admin()
        response = await execute_patch_request(
            "/admin/users/disable/not-a-uuid", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 422


# =========================================================================
# PATCH /admin/users/enable/{uuid}
# =========================================================================


class TestEnableUser:
    @pytest.mark.asyncio
    async def test_enable_ok(self):
        await push_one_admin()
        user = await _setup_user(disabled_at=utcnow())

        response = await execute_patch_request(
            f"/admin/users/enable/{user.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("already_enabled", 400),
            ("deleted", 400),
            ("not_found", 400),
        ],
        ids=["already_enabled", "deleted_user", "not_found"],
    )
    async def test_enable_errors(self, session, scenario, expected_status):
        await push_one_admin()

        if scenario == "already_enabled":
            user = await _setup_user()
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=utcnow())
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/enable/{target_id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status


# =========================================================================
# DELETE /admin/users/delete/{uuid}
# =========================================================================


class TestAdminDeleteUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self):
        await push_one_admin()
        user = await _setup_user()

        response = await execute_delete_request(
            f"/admin/users/delete/{user.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("already_deleted", 400),
            ("is_admin", 400),
            ("not_found", 400),
        ],
        ids=["already_deleted", "target_is_admin", "not_found"],
    )
    async def test_delete_errors(self, session, scenario, expected_status):
        await push_one_admin()

        if scenario == "already_deleted":
            user = await _setup_user(deleted_at=utcnow())
            target_id = user.id
        elif scenario == "is_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(),
                login="admin2",
                email=ADMIN2_EMAIL,
                discord_id="discord_admin2",
                role=Roles.ADMIN,
            )
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_delete_request(
            f"/admin/users/delete/{target_id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status


# =========================================================================
# PATCH /admin/users/promote/{uuid}
# =========================================================================


class TestPromoteUser:
    @pytest.mark.asyncio
    async def test_super_admin_can_promote(self):
        """Only super_admin can promote a user to admin."""
        await push_one_super_admin()
        user = await _setup_user()

        response = await execute_patch_request(
            f"/admin/users/promote/{user.id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_cannot_promote(self):
        """Admin (non-super) is forbidden from promoting users."""
        await push_one_admin()
        user = await _setup_user()

        response = await execute_patch_request(
            f"/admin/users/promote/{user.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("already_admin", 400),
            ("deleted", 400),
            ("not_found", 400),
        ],
        ids=["already_admin", "deleted_user", "not_found"],
    )
    async def test_promote_errors(self, session, scenario, expected_status):
        await push_one_super_admin()

        if scenario == "already_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(),
                login="admin2",
                email=ADMIN2_EMAIL,
                discord_id="discord_admin2",
                role=Roles.ADMIN,
            )
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=utcnow())
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/promote/{target_id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_promote_invalid_uuid_returns_422(self):
        await push_one_super_admin()
        response = await execute_patch_request(
            "/admin/users/promote/not-a-uuid", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 422


# =========================================================================
# SUPER_ADMIN related access control
# =========================================================================


class TestSuperAdminAccess:
    @pytest.mark.asyncio
    async def test_super_admin_can_access_admin_routes(self):
        """Super admin can list users via /admin/users."""
        await push_one_super_admin()
        response = await execute_get_request(ADMIN_USERS_URL, headers=SUPER_ADMIN_HEADERS)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_cannot_disable_super_admin(self):
        """Targeting a super_admin user for disable should fail."""
        await push_one_super_admin()
        target = await _setup_user(
            user_id=uuid.uuid4(),
            login="superadmin2",
            email="sa2@gmail.com",
            discord_id="discord_sa2",
            role=Roles.SUPER_ADMIN,
        )
        response = await execute_patch_request(
            f"/admin/users/disable/{target.id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_cannot_delete_super_admin(self):
        """Targeting a super_admin user for deletion should fail."""
        await push_one_super_admin()
        target = await _setup_user(
            user_id=uuid.uuid4(),
            login="superadmin2",
            email="sa2@gmail.com",
            discord_id="discord_sa2",
            role=Roles.SUPER_ADMIN,
        )
        response = await execute_delete_request(
            f"/admin/users/delete/{target.id}", headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 400


# =========================================================================
# PATCH /admin/users/promote/{uuid} — disabled user branch (line 173)
# =========================================================================


class TestPromoteUserDisabled:
    @pytest.mark.asyncio
    async def test_promote_disabled_user_ok(self):
        """Promoting a disabled user succeeds and clears disabled_at (line 175)."""
        await push_one_super_admin()
        user = await _setup_user(disabled_at=utcnow())

        response = await execute_patch_request(
            f"/admin/users/promote/{user.id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 200


# =========================================================================
# PATCH /admin/users/demote/{uuid} — lines 181-192
# =========================================================================


class TestDemoteUser:
    @pytest.mark.asyncio
    async def test_super_admin_can_demote(self):
        """Super admin can demote an admin to user role."""
        await push_one_super_admin()
        user = await _setup_user(
            user_id=uuid.uuid4(),
            login="admin_to_demote",
            email="demote@gmail.com",
            discord_id="discord_demote",
            role=Roles.ADMIN,
        )

        response = await execute_patch_request(
            f"/admin/users/demote/{user.id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_cannot_demote(self):
        """Non-super admin is forbidden from demoting users."""
        await push_one_admin()
        user = await _setup_user(
            user_id=uuid.uuid4(),
            login="admin_to_demote",
            email="demote@gmail.com",
            discord_id="discord_demote",
            role=Roles.ADMIN,
        )

        response = await execute_patch_request(
            f"/admin/users/demote/{user.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "scenario, expected_status",
        [
            ("not_admin", 400),
            ("deleted", 400),
            ("not_found", 400),
        ],
        ids=["target_is_not_admin", "target_is_deleted", "not_found"],
    )
    async def test_demote_errors(self, session, scenario, expected_status):
        await push_one_super_admin()

        if scenario == "not_admin":
            user = await _setup_user()
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=utcnow())
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/demote/{target_id}", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_demote_invalid_uuid_returns_422(self):
        await push_one_super_admin()
        response = await execute_patch_request(
            "/admin/users/demote/not-a-uuid", {}, headers=SUPER_ADMIN_HEADERS
        )
        assert response.status_code == 422


# =========================================================================
# GET /admin/users — filter branches (lines 229-234, 249-253)
# =========================================================================


class TestListUsersFilters:
    @pytest.mark.asyncio
    async def test_list_users_with_status_filter(self):
        """GET /admin/users?status=enabled hits the status filter branch (line 230)."""
        await push_one_admin()
        response = await execute_get_request(
            f"{ADMIN_USERS_URL}?status=enabled", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_users_with_disabled_status_filter(self):
        """GET /admin/users?status=disabled — hits disabled branch (lines 198-199)."""
        await push_one_admin()
        response = await execute_get_request(
            f"{ADMIN_USERS_URL}?status=disabled", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_users_with_deleted_status_filter(self):
        """GET /admin/users?status=deleted — hits deleted branch (line 197)."""
        await push_one_admin()
        response = await execute_get_request(
            f"{ADMIN_USERS_URL}?status=deleted", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_users_with_role_filter(self):
        """GET /admin/users?role=user hits the role filter branch (line 232)."""
        await push_one_admin()
        response = await execute_get_request(f"{ADMIN_USERS_URL}?role=user", headers=ADMIN_HEADERS)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_users_with_search_filter(self):
        """GET /admin/users?search=admin hits the search filter branch (line 234)."""
        await push_one_admin()
        response = await execute_get_request(
            f"{ADMIN_USERS_URL}?search=admin", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_users_with_all_filters(self):
        """All three filters applied together exercises all three branches."""
        await push_one_admin()
        response = await execute_get_request(
            f"{ADMIN_USERS_URL}?status=enabled&role=user&search=test",
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
