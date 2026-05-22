"""Integration tests for season endpoints."""

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
)
from tests.utils.utils_constant import USER_ID, GAME_PSEUDO, ALLIANCE_NAME, ALLIANCE_TAG
from tests.utils.utils_db import get_test_session, load_objects
from tests.integration.endpoints.setup.game_setup import push_alliance_with_owner
from tests.integration.endpoints.setup.user_setup import get_admin, get_generic_user

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)

SEASONS_URL = "/admin/seasons"
CURRENT_URL = "/seasons/current"


@pytest.fixture()
async def admin_in_db():
    await load_objects([get_admin()])


class TestCreateSeason:
    @pytest.mark.anyio
    async def test_admin_can_create_season(self):
        response = await execute_post_request(SEASONS_URL, {"number": 64}, ADMIN_HEADERS)
        assert response.status_code == 201
        data = response.json()
        assert data["number"] == 64
        assert data["is_big_thing"] is False

    @pytest.mark.anyio
    async def test_duplicate_number_returns_409(self):
        await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        response = await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_non_admin_returns_403(self):
        response = await execute_post_request(SEASONS_URL, {"number": 66}, USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_number_zero_returns_422(self):
        response = await execute_post_request(SEASONS_URL, {"number": 0}, ADMIN_HEADERS)
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_negative_number_returns_422(self):
        response = await execute_post_request(SEASONS_URL, {"number": -1}, ADMIN_HEADERS)
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_number_above_max_returns_422(self):
        response = await execute_post_request(SEASONS_URL, {"number": 10000}, ADMIN_HEADERS)
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_number_at_max_boundary_succeeds(self):
        response = await execute_post_request(SEASONS_URL, {"number": 9999}, ADMIN_HEADERS)
        assert response.status_code == 201
        assert response.json()["number"] == 9999

    @pytest.mark.anyio
    async def test_number_at_min_boundary_succeeds(self):
        response = await execute_post_request(SEASONS_URL, {"number": 1}, ADMIN_HEADERS)
        assert response.status_code == 201
        assert response.json()["number"] == 1


class TestCreateSeasonBigThing:
    @pytest.mark.anyio
    async def test_create_big_thing_season(self, admin_in_db):
        response = await execute_post_request(
            SEASONS_URL, {"number": 70, "is_big_thing": True}, ADMIN_HEADERS
        )
        assert response.status_code == 201
        assert response.json()["is_big_thing"] is True

    @pytest.mark.anyio
    async def test_create_normal_season_default(self, admin_in_db):
        response = await execute_post_request(SEASONS_URL, {"number": 71}, ADMIN_HEADERS)
        assert response.status_code == 201
        assert response.json()["is_big_thing"] is False


class TestGetCurrentSeason:
    @pytest.fixture()
    async def user_in_db(self):
        await load_objects([get_generic_user(is_base_id=True)])

    @pytest.mark.anyio
    async def test_returns_null_when_no_active_season(self, user_in_db):
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json() is None


class TestListSeasonsPublic:
    @pytest.fixture()
    async def user_in_db(self):
        await load_objects([get_generic_user(is_base_id=True)])

    @pytest.fixture()
    async def member_in_alliance(self):
        await load_objects([get_generic_user(is_base_id=True)])
        await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )

    @pytest.mark.anyio
    async def test_member_can_list_seasons(self, member_in_alliance):
        await execute_post_request(SEASONS_URL, {"number": 10}, ADMIN_HEADERS)
        await execute_post_request(SEASONS_URL, {"number": 11}, ADMIN_HEADERS)

        response = await execute_get_request("/seasons", USER_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["number"] == 11

    @pytest.mark.anyio
    async def test_non_member_gets_403(self, user_in_db):
        response = await execute_get_request("/seasons", USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_unauthenticated_gets_401(self):
        response = await execute_get_request("/seasons", {})
        assert response.status_code == 401
