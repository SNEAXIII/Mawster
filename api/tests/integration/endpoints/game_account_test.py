"""Integration tests for /game-accounts endpoints."""
import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, get_user
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
    push_member,
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
    USER_LOGIN,
    USER_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
)
from tests.utils.utils_db import get_test_session, load_objects
from tests.integration.endpoints.setup.user_setup import get_generic_user

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_user():
    """Insert the standard test user."""
    await push_one_user()


async def _setup_user2():
    """Insert a second user."""
    user2 = get_generic_user(
        login=USER2_LOGIN,
        email=USER2_EMAIL,
        role=Roles.USER,
    )
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])


# =========================================================================
# POST /game-accounts
# =========================================================================


class TestCreateGameAccount:
    @pytest.mark.asyncio
    async def test_create_ok(self, session):
        await _setup_user()
        response = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": GAME_PSEUDO, "is_primary": True},
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["game_pseudo"] == GAME_PSEUDO
        assert body["is_primary"] is True

    @pytest.mark.asyncio
    async def test_create_without_auth_returns_401(self, session):
        response = await execute_post_request(
            "/game-accounts",
            {"game_pseudo": GAME_PSEUDO, "is_primary": False},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_exceeds_limit(self, session):
        await _setup_user()
        # Create 10 accounts
        for i in range(10):
            await push_game_account(user_id=USER_ID, game_pseudo=f"Player{i}")

        response = await execute_post_request(
            "/game-accounts",
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
        await _setup_user()
        response = await execute_post_request(
            "/game-accounts", payload, headers=HEADERS,
        )
        assert response.status_code == 400


# =========================================================================
# GET /game-accounts
# =========================================================================


class TestGetMyGameAccounts:
    @pytest.mark.asyncio
    async def test_list_empty(self, session):
        await _setup_user()
        response = await execute_get_request("/game-accounts", headers=HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_own_accounts(self, session):
        await _setup_user()
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request("/game-accounts", headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2

    @pytest.mark.asyncio
    async def test_list_sorted_primary_first(self, session):
        """Primary accounts should appear before non-primary."""
        await _setup_user()
        await push_game_account(user_id=USER_ID, game_pseudo="NonPrimary", is_primary=False)
        await push_game_account(user_id=USER_ID, game_pseudo="Primary", is_primary=True)

        response = await execute_get_request("/game-accounts", headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body[0]["is_primary"] is True
        assert body[0]["game_pseudo"] == "Primary"

    @pytest.mark.asyncio
    async def test_list_includes_alliance_tag(self, session):
        """Accounts that are in an alliance should return alliance_tag and alliance_name."""
        await _setup_user()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        # Also add a free account
        await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request("/game-accounts", headers=HEADERS)
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
        await _setup_user()
        await _setup_user2()
        await push_game_account(user_id=USER2_ID, game_pseudo="OtherPlayer")

        response = await execute_get_request("/game-accounts", headers=HEADERS)
        assert response.status_code == 200
        assert len(response.json()) == 0


# =========================================================================
# GET /game-accounts/{id}
# =========================================================================


class TestGetSingleGameAccount:
    @pytest.mark.asyncio
    async def test_get_own_account(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        assert response.json()["game_pseudo"] == GAME_PSEUDO

    @pytest.mark.asyncio
    async def test_get_other_users_account_returns_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_get_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, session):
        await _setup_user()
        import uuid

        response = await execute_get_request(
            f"/game-accounts/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404


# =========================================================================
# PUT /game-accounts/{id}
# =========================================================================


class TestUpdateGameAccount:
    @pytest.mark.asyncio
    async def test_update_ok(self, session):
        await _setup_user()
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
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_put_request(
            f"/game-accounts/{acc.id}",
            {"game_pseudo": "Hacked", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self, session):
        await _setup_user()
        import uuid

        response = await execute_put_request(
            f"/game-accounts/{uuid.uuid4()}",
            {"game_pseudo": "X", "is_primary": False},
            headers=HEADERS,
        )
        assert response.status_code == 404


# =========================================================================
# DELETE /game-accounts/{id}
# =========================================================================


class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_delete_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_other_users_account_returns_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo="Other")

        response = await execute_delete_request(
            f"/game-accounts/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, session):
        await _setup_user()
        import uuid

        response = await execute_delete_request(
            f"/game-accounts/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404
