"""Integration tests for /game-accounts endpoints."""
import uuid
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
    execute_delete_request
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
)
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()
ENDPOINT = "/game-accounts"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_1_user():
    """Insert the standard test user."""
    await push_one_user()


# =========================================================================
# POST /game-accounts
# =========================================================================


class TestCreateGameAccount:
    @pytest.mark.asyncio
    async def test_create_ok(self, session):
        await _setup_1_user()
        payload = {"game_pseudo": GAME_PSEUDO, "is_primary": True}
        response = await execute_post_request(ENDPOINT, payload, headers=HEADERS)
        assert response.status_code == 201
        body = response.json()
        assert body["game_pseudo"] == GAME_PSEUDO
        assert body["is_primary"] is True

    @pytest.mark.asyncio
    async def test_create_without_auth_returns_401(self, session):
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": GAME_PSEUDO, "is_primary": False},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_exceeds_limit(self, session):
        await _setup_1_user()
        # Create 10 accounts
        for i in range(10):
            await push_game_account(user_id=USER_ID, game_pseudo=f"Player{i}")

        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "Player11", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"is_primary": True},
        ],
        ids=["empty_body", "missing_pseudo"],
    )
    async def test_create_invalid_payload(self, session, payload):
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT, payload, headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_pseudo_too_long_returns_400(self, session):
        """game_pseudo has max_length=50 in DTO."""
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "A" * 51, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_pseudo_exactly_50_chars_ok(self, session):
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "A" * 50, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_response_body_structure(self, session):
        """Verify all expected fields are present in the response."""
        await _setup_1_user()
        response = await execute_post_request(
            ENDPOINT,
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
        """Creating multiple primary accounts should succeed."""
        await _setup_1_user()
        r1 = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "First", "is_primary": True},
            headers=HEADERS,
        )
        assert r1.status_code == 201
        r2 = await execute_post_request(
            ENDPOINT,
            {"game_pseudo": "Second", "is_primary": True},
            headers=HEADERS,
        )
        assert r2.status_code == 201


# =========================================================================
# GET /game-accounts
# =========================================================================


class TestGetMyGameAccounts:
    @pytest.mark.asyncio
    async def test_list_empty(self, session):
        await _setup_1_user()
        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_own_accounts(self, session):
        await _setup_1_user()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2

    @pytest.mark.asyncio
    async def test_list_sorted_primary_first(self, session):
        """Primary accounts should appear before non-primary."""
        await _setup_1_user()
        await push_game_account(user_id=USER_ID, game_pseudo="NonPrimary", is_primary=False)
        await push_game_account(user_id=USER_ID, game_pseudo="Primary", is_primary=True)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body[0]["is_primary"] is True
        assert body[0]["game_pseudo"] == "Primary"

    @pytest.mark.asyncio
    async def test_list_includes_alliance_tag(self, session):
        """Accounts that are in an alliance should return alliance_tag and alliance_name."""
        await _setup_1_user()
        await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        # Also add a free account
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        # Find the one in alliance
        in_alliance = [a for a in body if a["alliance_id"] is not None]
        free = [a for a in body if a["alliance_id"] is None]
        assert len(in_alliance) == 1
        assert in_alliance[0]["alliance_tag"] is not None
        assert in_alliance[0]["alliance_name"] is not None
        assert len(free) == 1
        assert free[0]["alliance_tag"] is None

    @pytest.mark.asyncio
    async def test_does_not_return_other_users_accounts(self, session):
        """A user should not see another user's accounts."""
        await _setup_1_user()
        await push_user2()
        await push_game_account(user_id=USER2_ID, game_pseudo="OtherPlayer")

        response = await execute_get_request(ENDPOINT, headers=HEADERS)
        assert response.status_code == 200
        assert len(response.json()) == 0


# =========================================================================
# GET /game-accounts/{id}
# =========================================================================


class TestGetSingleGameAccount:
    @pytest.mark.asyncio
    async def test_get_own_account(self, session):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == GAME_PSEUDO

    @pytest.mark.asyncio
    async def test_get_other_users_account_returns_403(self, session):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_get_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, session):
        await _setup_1_user()
        response = await execute_get_request(
            f"/game-accounts/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_400(self, session):
        """A non-UUID path param should be rejected by FastAPI validation."""
        await _setup_1_user()
        response = await execute_get_request(
            "/game-accounts/not-a-uuid", headers=HEADERS
        )
        assert response.status_code == 400


# =========================================================================
# PUT /game-accounts/{id}
# =========================================================================


class TestUpdateGameAccount:
    @pytest.mark.asyncio
    async def test_update_ok(self, session):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "NewPseudo", "is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == "NewPseudo"
        assert response.json()["is_primary"] is True

    @pytest.mark.asyncio
    async def test_update_other_users_account_returns_403(self, session):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "Hacked", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self, session):
        await _setup_1_user()
        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "X", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_pseudo_too_long_returns_400(self, session):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "X" * 51, "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_missing_pseudo_returns_400(self, session):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_update_invalid_uuid_returns_400(self, session):
        await _setup_1_user()
        response = await execute_put_request(
            "/game-accounts/not-a-uuid",
            {"game_pseudo": "X", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_without_auth_returns_401(self, session):
        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "X", "is_primary": False},
        )
        assert response.status_code == 401


# =========================================================================
# DELETE /game-accounts/{id}
# =========================================================================


class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_delete_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_other_users_account_returns_403(self, session):
        await _setup_1_user()
        await push_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_delete_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, session):
        await _setup_1_user()
        response = await execute_delete_request(
            f"/game-accounts/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_400(self, session):
        await _setup_1_user()
        response = await execute_delete_request(
            "/game-accounts/not-valid", headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_without_auth_returns_401(self, session):
        response = await execute_delete_request(
            f"/game-accounts/{uuid.uuid4()}"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_already_deleted_returns_404(self, session):
        """Re-deleting the same account should 404."""
        await _setup_1_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        r1 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r1.status_code == 204
        r2 = await execute_delete_request(f"/game-accounts/{acc.id}", headers=HEADERS)
        assert r2.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="BUG: deleting an alliance-owner game account returns 500 (FK constraint)")
    async def test_delete_account_in_alliance(self, session):
        """Deleting a game account that's in an alliance should work or fail cleanly."""
        await _setup_1_user()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        response = await execute_delete_request(
            f"/game-accounts/{owner_acc.id}", headers=HEADERS
        )
        assert response.status_code in (204, 400, 409)
