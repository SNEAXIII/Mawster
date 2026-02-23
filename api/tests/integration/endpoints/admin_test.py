"""Integration tests for /admin endpoints — user management with parametrized access control."""
import uuid
from datetime import datetime

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
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
    ADMIN_LOGIN,
    ADMIN_EMAIL,
    DISCORD_ID,
    DISCORD_ID_2,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(login=ADMIN_LOGIN, user_id=str(USER_ID), email=ADMIN_EMAIL, role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(login=USER_LOGIN, user_id=str(USER_ID), email=USER_EMAIL, role=Roles.USER)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_admin():
    admin = get_generic_user(is_base_id=True, login=ADMIN_LOGIN, email=ADMIN_EMAIL, role=Roles.ADMIN)
    await load_objects([admin])


async def _setup_user(
    user_id=USER2_ID,
    login=USER2_LOGIN,
    email=USER2_EMAIL,
    discord_id=DISCORD_ID_2,
    disabled_at=None,
    deleted_at=None,
    role=Roles.USER,
):
    user = get_generic_user(login=login, email=email, role=role, disabled_at=disabled_at, deleted_at=deleted_at)
    user.id = user_id
    user.discord_id = discord_id
    await load_objects([user])
    return user


# =========================================================================
# GET /admin/users
# =========================================================================


class TestGetUsers:
    @pytest.mark.asyncio
    async def test_admin_can_list_users(self, session):
        await _setup_admin()
        await _setup_user()

        response = await execute_get_request("/admin/users", headers=ADMIN_HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body["total_users"] >= 2

    @pytest.mark.asyncio
    async def test_non_admin_cannot_list_users(self, session):
        response = await execute_get_request("/admin/users", headers=USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "page, size, expected_status",
        [
            (1, 10, 200),
            (0, 10, 400),
            (1, 0, 400),
        ],
        ids=["valid", "page_zero", "size_zero"],
    )
    async def test_pagination_validation(self, session, page, size, expected_status):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/users?page={page}&size={size}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status


# =========================================================================
# PATCH /admin/users/disable/{uuid}
# =========================================================================


class TestDisableUser:
    @pytest.mark.asyncio
    async def test_disable_ok(self, session):
        await _setup_admin()
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
        await _setup_admin()

        if scenario == "already_disabled":
            user = await _setup_user(disabled_at=datetime.now())
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=datetime.now())
            target_id = user.id
        elif scenario == "is_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(), login="admin2", email="admin2@gmail.com",
                discord_id="discord_admin2", role=Roles.ADMIN,
            )
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/disable/{target_id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status


# =========================================================================
# PATCH /admin/users/enable/{uuid}
# =========================================================================


class TestEnableUser:
    @pytest.mark.asyncio
    async def test_enable_ok(self, session):
        await _setup_admin()
        user = await _setup_user(disabled_at=datetime.now())

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
        await _setup_admin()

        if scenario == "already_enabled":
            user = await _setup_user()
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=datetime.now())
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
    async def test_delete_ok(self, session):
        await _setup_admin()
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
        await _setup_admin()

        if scenario == "already_deleted":
            user = await _setup_user(deleted_at=datetime.now())
            target_id = user.id
        elif scenario == "is_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(), login="admin2", email="admin2@gmail.com",
                discord_id="discord_admin2", role=Roles.ADMIN,
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
    async def test_promote_ok(self, session):
        await _setup_admin()
        user = await _setup_user()

        response = await execute_patch_request(
            f"/admin/users/promote/{user.id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

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
        await _setup_admin()

        if scenario == "already_admin":
            user = await _setup_user(
                user_id=uuid.uuid4(), login="admin2", email="admin2@gmail.com",
                discord_id="discord_admin2", role=Roles.ADMIN,
            )
            target_id = user.id
        elif scenario == "deleted":
            user = await _setup_user(deleted_at=datetime.now())
            target_id = user.id
        else:
            target_id = uuid.uuid4()

        response = await execute_patch_request(
            f"/admin/users/promote/{target_id}", {}, headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status
