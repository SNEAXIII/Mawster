"""Integration tests for /user endpoints — self-delete with confirmation."""
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
)
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()
CONFIRMATION_TEXT = "SUPPRIMER"


# =========================================================================
# DELETE /user/delete
# =========================================================================


class TestSelfDeleteUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await push_one_user()

        response = await execute_delete_request(
            "/user/delete",
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
            "/user/delete",
            headers=HEADERS,
            payload={"confirmation": confirmation},
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_delete_without_auth(self, session):
        response = await execute_delete_request(
            "/user/delete",
            payload={"confirmation": CONFIRMATION_TEXT},
        )
        assert response.status_code == 401
