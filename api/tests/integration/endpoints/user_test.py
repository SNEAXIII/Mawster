"""Integration tests for /user endpoints — self-delete and login update."""

import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_patch_request,
)
from tests.utils.utils_db import get_test_session
from tests.utils.utils_constant import USER2_LOGIN

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()
CONFIRMATION_TEXT = "SUPPRIMER"
ENDPOINT = "/user/delete"

# =========================================================================
# DELETE /user/delete
# =========================================================================


class TestSelfDeleteUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self):
        await push_one_user()

        response = await execute_delete_request(
            ENDPOINT,
            headers=HEADERS,
            payload={"confirmation": CONFIRMATION_TEXT},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "confirmation, expected_status",
        [
            ("WRONG", 400),
            ("supprimer", 400),  # case-sensitive
            ("", 400),
        ],
        ids=["wrong_text", "wrong_case", "empty"],
    )
    async def test_delete_wrong_confirmation(self, session, confirmation, expected_status):
        await push_one_user()

        response = await execute_delete_request(
            ENDPOINT,
            headers=HEADERS,
            payload={"confirmation": confirmation},
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_delete_without_auth(self):
        response = await execute_delete_request(
            ENDPOINT,
            payload={"confirmation": CONFIRMATION_TEXT},
        )
        assert response.status_code == 401


# =========================================================================
# PATCH /user/login
# =========================================================================

PATCH_ENDPOINT = "/user/login"


class TestUpdateLogin:
    @pytest.mark.asyncio
    async def test_update_login_ok(self):
        await push_one_user()

        response = await execute_patch_request(
            PATCH_ENDPOINT,
            headers=HEADERS,
            payload={"login": "NewLogin123"},
        )
        assert response.status_code == 200
        assert response.json()["login"] == "NewLogin123"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "login, expected_status",
        [
            ("ab", 422),
            ("a" * 31, 422),
            ("invalid login!", 422),
            ("has space", 422),
            ("tiret-interdit", 422),
        ],
        ids=["too_short", "too_long", "special_chars", "space", "dash"],
    )
    async def test_update_login_invalid(self, login, expected_status):
        await push_one_user()

        response = await execute_patch_request(
            PATCH_ENDPOINT,
            headers=HEADERS,
            payload={"login": login},
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_update_login_already_taken(self):
        await push_one_user()
        await push_user2()

        response = await execute_patch_request(
            PATCH_ENDPOINT,
            headers=HEADERS,
            payload={"login": USER2_LOGIN},
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_update_login_without_auth(self):
        response = await execute_patch_request(
            PATCH_ENDPOINT,
            payload={"login": "ValidLogin"},
        )
        assert response.status_code == 401
