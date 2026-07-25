"""Integration tests for per-season saga admin endpoints.

GET /admin/seasons/{season_id}/saga — list champion saga roles for a season.
PUT /admin/seasons/{season_id}/saga/{champion_id} — upsert a champion's saga roles.
"""

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.integration.endpoints.setup.user_setup import push_one_admin, push_one_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)

SEASONS_URL = "/admin/seasons"


async def _create_season(number: int) -> dict:
    response = await execute_post_request(SEASONS_URL, {"number": number}, ADMIN_HEADERS)
    assert response.status_code == 201
    return response.json()


class TestUpsertAndListSagaRoles:
    @pytest.mark.asyncio
    async def test_admin_upsert_and_list_saga(self, session):
        await push_one_admin()
        season = await _create_season(500)
        champ = await push_champion("Hercules", "Cosmic")

        response = await execute_put_request(
            f"{SEASONS_URL}/{season['id']}/saga/{champ.id}",
            payload={"is_saga_attacker": True, "is_saga_defender": False},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["is_saga_attacker"] is True
        assert body["is_saga_defender"] is False
        assert body["season_id"] == season["id"]
        assert body["champion_id"] == str(champ.id)

        list_response = await execute_get_request(
            f"{SEASONS_URL}/{season['id']}/saga", headers=ADMIN_HEADERS
        )
        assert list_response.status_code == 200
        rows = list_response.json()
        assert any(row["champion_id"] == str(champ.id) and row["is_saga_attacker"] for row in rows)

    @pytest.mark.asyncio
    async def test_upsert_updates_existing_role(self, session):
        await push_one_admin()
        season = await _create_season(501)
        champ = await push_champion("Storm", "Mutant")

        await execute_put_request(
            f"{SEASONS_URL}/{season['id']}/saga/{champ.id}",
            payload={"is_saga_attacker": True, "is_saga_defender": True},
            headers=ADMIN_HEADERS,
        )
        response = await execute_put_request(
            f"{SEASONS_URL}/{season['id']}/saga/{champ.id}",
            payload={"is_saga_attacker": False, "is_saga_defender": True},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["is_saga_attacker"] is False
        assert response.json()["is_saga_defender"] is True

        list_response = await execute_get_request(
            f"{SEASONS_URL}/{season['id']}/saga", headers=ADMIN_HEADERS
        )
        rows = list_response.json()
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_list_empty_when_no_roles(self, session):
        await push_one_admin()
        season = await _create_season(502)

        response = await execute_get_request(
            f"{SEASONS_URL}/{season['id']}/saga", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_scoped_per_season(self, session):
        await push_one_admin()
        season_a = await _create_season(503)
        await execute_patch_request(f"{SEASONS_URL}/{season_a['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{season_a['id']}/close", {}, ADMIN_HEADERS)
        season_b = await _create_season(504)
        champ = await push_champion("Magik", "Mutant")

        await execute_put_request(
            f"{SEASONS_URL}/{season_a['id']}/saga/{champ.id}",
            payload={"is_saga_attacker": True, "is_saga_defender": False},
            headers=ADMIN_HEADERS,
        )

        response = await execute_get_request(
            f"{SEASONS_URL}/{season_b['id']}/saga", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_non_admin_is_forbidden(self, session):
        await push_one_user()
        season_id = str(uuid.uuid4())
        champ_id = str(uuid.uuid4())

        put_response = await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{champ_id}",
            payload={"is_saga_attacker": True, "is_saga_defender": False},
            headers=USER_HEADERS,
        )
        assert put_response.status_code == 403

        get_response = await execute_get_request(
            f"{SEASONS_URL}/{season_id}/saga", headers=USER_HEADERS
        )
        assert get_response.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_is_401(self, session):
        season_id = str(uuid.uuid4())
        champ_id = str(uuid.uuid4())

        put_response = await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{champ_id}",
            payload={"is_saga_attacker": True, "is_saga_defender": False},
            headers=None,
        )
        assert put_response.status_code == 401

        get_response = await execute_get_request(f"{SEASONS_URL}/{season_id}/saga", headers=None)
        assert get_response.status_code == 401
