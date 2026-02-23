"""Hardened integration tests for /admin (user management) endpoints.

Strict status code assertions and edge cases.
"""
import uuid
import pytest
from datetime import datetime

from src.enums.Roles import Roles
from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    push_one_user,
    push_one_admin,
    get_generic_user,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_patch_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(role=Roles.USER)
ADMIN_HEADERS = create_auth_headers(role=Roles.ADMIN)


async def _setup_admin():
    await push_one_admin()


async def _setup_user():
    await push_one_user()


async def _setup_target_user(
    disabled_at=None, deleted_at=None, role=Roles.USER
):
    """Create a second user to be the target of admin operations."""
    user2 = get_generic_user(
        login=USER2_LOGIN, email=USER2_EMAIL, role=role,
        disabled_at=disabled_at, deleted_at=deleted_at,
    )
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])
    return user2


# =========================================================================
# GET /admin/users
# =========================================================================


class TestGetUsersHardened:
    @pytest.mark.asyncio
    async def test_admin_can_list_returns_200(self, session):
        await _setup_admin()
        response = await execute_get_request("/admin/users", headers=ADMIN_HEADERS)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_user_role_returns_exact_403(self, session):
        await _setup_user()
        response = await execute_get_request("/admin/users", headers=USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_auth_returns_403(self, session):
        response = await execute_get_request("/admin/users")
        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "params,expected_code",
        [
            ("?page=0", 400),
            ("?page=-1", 400),
            ("?size=0", 400),
            ("?size=-1", 400),
        ],
        ids=["page_zero", "page_negative", "size_zero", "size_negative"],
    )
    async def test_pagination_validation(self, session, params, expected_code):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/users{params}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_code

    @pytest.mark.asyncio
    async def test_response_structure(self, session):
        await _setup_admin()
        await _setup_target_user()
        response = await execute_get_request("/admin/users", headers=ADMIN_HEADERS)
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


class TestDisableUserHardened:
    @pytest.mark.asyncio
    async def test_disable_ok(self, session):
        await _setup_admin()
        user2 = await _setup_target_user()
        response = await execute_patch_request(
            f"/admin/users/disable/{user2.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_disable_nonexistent_user(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            f"/admin/users/disable/{uuid.uuid4()}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200
        assert response.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_disable_deleted_user(self, session):
        await _setup_admin()
        await _setup_target_user(deleted_at=datetime.now())
        response = await execute_patch_request(
            f"/admin/users/disable/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_disable_already_disabled_user(self, session):
        await _setup_admin()
        await _setup_target_user(disabled_at=datetime.now())
        response = await execute_patch_request(
            f"/admin/users/disable/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_disable_admin_user(self, session):
        """Should not be able to disable another admin."""
        await _setup_admin()
        await _setup_target_user(role=Roles.ADMIN)
        response = await execute_patch_request(
            f"/admin/users/disable/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_disable_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_patch_request(
            f"/admin/users/disable/{uuid.uuid4()}", {}, headers=USER_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_disable_invalid_uuid_returns_422(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            "/admin/users/disable/not-a-uuid", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 422


# =========================================================================
# PATCH /admin/users/enable/{uuid}
# =========================================================================


class TestEnableUserHardened:
    @pytest.mark.asyncio
    async def test_enable_disabled_user_ok(self, session):
        await _setup_admin()
        await _setup_target_user(disabled_at=datetime.now())
        response = await execute_patch_request(
            f"/admin/users/enable/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_enable_nonexistent_user(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            f"/admin/users/enable/{uuid.uuid4()}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_enable_deleted_user(self, session):
        await _setup_admin()
        await _setup_target_user(deleted_at=datetime.now())
        response = await execute_patch_request(
            f"/admin/users/enable/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_enable_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_patch_request(
            f"/admin/users/enable/{uuid.uuid4()}", {}, headers=USER_HEADERS
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /admin/users/delete/{uuid}
# =========================================================================


class TestAdminDeleteUserHardened:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await _setup_admin()
        await _setup_target_user()
        response = await execute_delete_request(
            f"/admin/users/delete/{USER2_ID}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, session):
        await _setup_admin()
        response = await execute_delete_request(
            f"/admin/users/delete/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_delete_already_deleted_user(self, session):
        await _setup_admin()
        await _setup_target_user(deleted_at=datetime.now())
        response = await execute_delete_request(
            f"/admin/users/delete/{USER2_ID}", headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_delete_admin_user_forbidden(self, session):
        """Should not be able to soft-delete another admin."""
        await _setup_admin()
        await _setup_target_user(role=Roles.ADMIN)
        response = await execute_delete_request(
            f"/admin/users/delete/{USER2_ID}", headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_delete_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_delete_request(
            f"/admin/users/delete/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 403


# =========================================================================
# PATCH /admin/users/promote/{uuid}
# =========================================================================


class TestPromoteUserHardened:
    @pytest.mark.asyncio
    async def test_promote_ok(self, session):
        await _setup_admin()
        await _setup_target_user()
        response = await execute_patch_request(
            f"/admin/users/promote/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_promote_nonexistent_user(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            f"/admin/users/promote/{uuid.uuid4()}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_promote_already_admin(self, session):
        await _setup_admin()
        await _setup_target_user(role=Roles.ADMIN)
        response = await execute_patch_request(
            f"/admin/users/promote/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_promote_deleted_user(self, session):
        await _setup_admin()
        await _setup_target_user(deleted_at=datetime.now())
        response = await execute_patch_request(
            f"/admin/users/promote/{USER2_ID}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code != 200

    @pytest.mark.asyncio
    async def test_promote_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_patch_request(
            f"/admin/users/promote/{uuid.uuid4()}", {}, headers=USER_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_promote_invalid_uuid_returns_422(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            "/admin/users/promote/not-a-uuid", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 422
