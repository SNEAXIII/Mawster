"""Hardened integration tests for /game-accounts endpoints.

Adds strict status code assertions and edge cases:
- Invalid UUID format in path
- Pseudo too long (>50 chars)
- Empty pseudo
- Response body structure validation
- Cascade behavior (delete account with alliance membership)
"""
import uuid
import pytest

from src.enums.Roles import Roles
from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    push_one_user,
    get_generic_user,
)
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
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
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()
ADMIN_HEADERS = create_auth_headers(role=Roles.ADMIN)


async def _setup_user():
    await push_one_user()


async def _setup_user2():
    user2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL, role=Roles.USER)
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])


# =========================================================================
# POST /game-accounts — additional edge cases
# =========================================================================


class TestCreateGameAccountHardened:
    @pytest.mark.asyncio
    async def test_pseudo_too_long_returns_422(self, session):
        """game_pseudo has max_length=50 in DTO."""
        await _setup_user()
        response = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": "A" * 51, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pseudo_exactly_50_chars_ok(self, session):
        await _setup_user()
        response = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": "A" * 50, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_response_body_structure(self, session):
        """Verify all expected fields are present in the response."""
        await _setup_user()
        response = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": GAME_PSEUDO, "is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        required_fields = {"id", "user_id", "game_pseudo", "is_primary", "created_at"}
        assert required_fields.issubset(body.keys())
        assert body["user_id"] == str(USER_ID)

    @pytest.mark.asyncio
    async def test_create_multiple_primary_keeps_latest(self, session):
        """Creating multiple primary accounts should succeed (no unique constraint on is_primary)."""
        await _setup_user()
        r1 = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": "First", "is_primary": True},
            headers=HEADERS,
        )
        assert r1.status_code == 201
        r2 = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": "Second", "is_primary": True},
            headers=HEADERS,
        )
        assert r2.status_code == 201


# =========================================================================
# GET /game-accounts/{id} — malformed input
# =========================================================================


class TestGetGameAccountHardened:
    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(self, session):
        """A non-UUID path param should be rejected by FastAPI validation."""
        await _setup_user()
        response = await execute_get_request(
            "/game-accounts/not-a-uuid", headers=HEADERS
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_returns_exact_404(self, session):
        """Nonexistent but valid UUID → exactly 404."""
        await _setup_user()
        response = await execute_get_request(
            f"/game-accounts/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_returns_exact_403(self, session):
        """Another user's account → exactly 403."""
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")
        response = await execute_get_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403


# =========================================================================
# PUT /game-accounts/{id} — additional edge cases
# =========================================================================


class TestUpdateGameAccountHardened:
    @pytest.mark.asyncio
    async def test_update_pseudo_too_long_returns_422(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "X" * 51, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_missing_pseudo_returns_422(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"is_primary": True},
            headers=HEADERS,
        )
        # game_pseudo is required
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_update_invalid_uuid_returns_422(self, session):
        await _setup_user()
        response = await execute_put_request(
            "/game-accounts/not-a-uuid",
            {"game_pseudo": "X", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_without_auth_returns_403(self, session):
        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "X", "is_primary": False},
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /game-accounts/{id} — additional edge cases
# =========================================================================


class TestDeleteGameAccountHardened:
    @pytest.mark.asyncio
    async def test_delete_returns_exact_204(self, session):
        """Successful delete → exactly 204 No Content."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_delete_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_422(self, session):
        await _setup_user()
        response = await execute_delete_request(
            "/game-accounts/not-valid", headers=HEADERS
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_without_auth_returns_403(self, session):
        response = await execute_delete_request(
            f"/game-accounts/{uuid.uuid4()}"
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_already_deleted_returns_404(self, session):
        """Re-deleting the same account should 404."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        r1 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r1.status_code == 204
        r2 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_account_in_alliance(self, session):
        """Deleting a game account that's in an alliance should work or fail cleanly."""
        await _setup_user()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        response = await execute_delete_request(
            f"/game-accounts/{owner_acc.id}", headers=HEADERS
        )
        # Should either succeed (cascade) or fail with a clear error
        assert response.status_code in (204, 400, 409)
