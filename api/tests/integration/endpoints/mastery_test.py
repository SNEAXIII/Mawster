"""Integration tests for mastery endpoints."""
import uuid
import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, push_one_admin, push_user2
from tests.integration.endpoints.setup.game_setup import push_game_account
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
    execute_delete_request,
)
from tests.utils.utils_constant import USER_ID, USER2_ID, GAME_PSEUDO
from tests.utils.utils_db import get_test_session, load_objects
from src.models.Mastery import Mastery

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)

ADMIN_MASTERIES_URL = "/admin/masteries"


async def _push_mastery(name: str = "ASSASSIN", max_value: int = 6, order: int = 0) -> Mastery:
    mastery = Mastery(name=name, max_value=max_value, order=order)
    await load_objects([mastery])
    return mastery


# =========================================================================
# Admin mastery CRUD
# =========================================================================

class TestAdminMasteryCRUD:
    @pytest.mark.asyncio
    async def test_create_mastery_ok(self):
        await push_one_admin()
        response = await execute_post_request(
            ADMIN_MASTERIES_URL,
            {"name": "ASSASSIN", "max_value": 6, "order": 0},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "ASSASSIN"
        assert body["max_value"] == 6

    @pytest.mark.asyncio
    async def test_create_mastery_non_admin_returns_403(self):
        await push_one_user()
        response = await execute_post_request(
            ADMIN_MASTERIES_URL,
            {"name": "ASSASSIN", "max_value": 6, "order": 0},
            headers=USER_HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_masteries_ok(self):
        await push_one_admin()
        await _push_mastery("RECOIL", 3, 1)
        response = await execute_get_request(ADMIN_MASTERIES_URL, headers=ADMIN_HEADERS)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_update_mastery_ok(self):
        await push_one_admin()
        mastery = await _push_mastery()
        response = await execute_put_request(
            f"{ADMIN_MASTERIES_URL}/{mastery.id}",
            {"name": "ASSASSIN RENAMED", "order": 5},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "ASSASSIN RENAMED"
        assert response.json()["max_value"] == 6  # unchanged

    @pytest.mark.asyncio
    async def test_delete_mastery_ok(self):
        await push_one_admin()
        mastery = await _push_mastery()
        response = await execute_delete_request(
            f"{ADMIN_MASTERIES_URL}/{mastery.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_mastery_not_found_returns_404(self):
        await push_one_admin()
        response = await execute_delete_request(
            f"{ADMIN_MASTERIES_URL}/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404


# =========================================================================
# Game account mastery GET / PUT
# =========================================================================

class TestGameAccountMasteries:
    @pytest.mark.asyncio
    async def test_get_masteries_empty(self):
        await push_one_user()
        account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_get_request(
            f"/game-accounts/{account.id}/masteries", headers=USER_HEADERS
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_upsert_masteries_ok(self):
        await push_one_user()
        account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        mastery = await _push_mastery("ASSASSIN", 6)
        payload = [{"mastery_id": str(mastery.id), "unlocked": 4, "attack": 4, "defense": 2}]
        response = await execute_put_request(
            f"/game-accounts/{account.id}/masteries", payload, headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["unlocked"] == 4
        assert body[0]["attack"] == 4
        assert body[0]["defense"] == 2

    @pytest.mark.asyncio
    async def test_upsert_masteries_unlocked_exceeds_max_returns_422(self):
        await push_one_user()
        account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        mastery = await _push_mastery("ASSASSIN", 6)
        payload = [{"mastery_id": str(mastery.id), "unlocked": 99, "attack": 0, "defense": 0}]
        response = await execute_put_request(
            f"/game-accounts/{account.id}/masteries", payload, headers=USER_HEADERS
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_upsert_masteries_other_user_returns_403(self):
        await push_one_user()
        await push_user2()
        account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        mastery = await _push_mastery()
        payload = [{"mastery_id": str(mastery.id), "unlocked": 2, "attack": 2, "defense": 0}]
        response = await execute_put_request(
            f"/game-accounts/{account.id}/masteries",
            payload,
            headers=USER2_HEADERS,
        )
        assert response.status_code == 403
