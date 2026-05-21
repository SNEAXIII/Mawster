"""Integration tests for season endpoints."""

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_patch_request,
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
        assert data["is_active"] is False

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


class TestActivateSeason:
    @pytest.mark.anyio
    async def test_activate_sets_is_active_true(self, admin_in_db):
        create = await execute_post_request(SEASONS_URL, {"number": 70}, ADMIN_HEADERS)
        season_id = create.json()["id"]
        response = await execute_patch_request(
            f"{SEASONS_URL}/{season_id}/activate", {}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is True

    @pytest.mark.anyio
    async def test_activating_deactivates_previous(self, admin_in_db):
        s1 = (await execute_post_request(SEASONS_URL, {"number": 71}, ADMIN_HEADERS)).json()
        s2 = (await execute_post_request(SEASONS_URL, {"number": 72}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/activate", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s2['id']}/activate", {}, ADMIN_HEADERS)
        all_seasons = (await execute_get_request(SEASONS_URL, ADMIN_HEADERS)).json()
        s1_data = next(s for s in all_seasons if s["id"] == s1["id"])
        assert s1_data["is_active"] is False

    @pytest.mark.anyio
    async def test_activate_unknown_season_returns_404(self, admin_in_db):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/activate", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404


class TestDeactivateSeason:
    @pytest.mark.anyio
    async def test_deactivate_sets_is_active_false(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 80}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/activate", {}, ADMIN_HEADERS)
        response = await execute_patch_request(
            f"{SEASONS_URL}/{s['id']}/deactivate", {}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    @pytest.mark.anyio
    async def test_deactivate_unknown_season_returns_404(self, admin_in_db):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/deactivate", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404


class TestGetCurrentSeason:
    @pytest.fixture()
    async def user_in_db(self):
        await load_objects([get_generic_user(is_base_id=True)])

    @pytest.mark.anyio
    async def test_returns_null_when_no_active_season(self, user_in_db):
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.anyio
    async def test_returns_active_season(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 90}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/activate", {}, ADMIN_HEADERS)
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json()["number"] == 90
        assert response.json()["is_active"] is True


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
