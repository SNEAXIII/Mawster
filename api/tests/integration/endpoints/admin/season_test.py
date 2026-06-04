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
        assert data["status"] == "upcoming"

    @pytest.mark.anyio
    async def test_duplicate_number_returns_409(self):
        await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        response = await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_create_rejected_when_current_exists(self):
        await execute_post_request(SEASONS_URL, {"number": 300}, ADMIN_HEADERS)
        response = await execute_post_request(SEASONS_URL, {"number": 301}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_create_allowed_after_previous_closed(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 310}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/close", {}, ADMIN_HEADERS)
        response = await execute_post_request(SEASONS_URL, {"number": 311}, ADMIN_HEADERS)
        assert response.status_code == 201

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
    async def test_create_defaults_to_regular_with_limits(self):
        response = await execute_post_request(SEASONS_URL, {"number": 200}, ADMIN_HEADERS)
        assert response.status_code == 201
        data = response.json()
        assert data["format"] == "regular"
        assert data["max_defenders_per_player"] == 5
        assert data["max_attackers_per_member"] == 3
        assert data["node_count"] == 50

    @pytest.mark.anyio
    async def test_create_big_thing_returns_big_thing_limits(self):
        response = await execute_post_request(
            SEASONS_URL, {"number": 201, "format": "big_thing"}, ADMIN_HEADERS
        )
        assert response.status_code == 201
        data = response.json()
        assert data["format"] == "big_thing"
        assert data["max_defenders_per_player"] == 1
        assert data["max_attackers_per_member"] == 2
        assert data["node_count"] == 10


class TestOpenSeason:
    @pytest.mark.anyio
    async def test_open_sets_status_active(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 70}, ADMIN_HEADERS)).json()
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "active"

    @pytest.mark.anyio
    async def test_open_unknown_season_returns_404(self, admin_in_db):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/open", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_reopen_closed_season(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 73}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/close", {}, ADMIN_HEADERS)
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "active"

    @pytest.mark.anyio
    async def test_open_rejected_when_another_current_exists(self, admin_in_db):
        s1 = (await execute_post_request(SEASONS_URL, {"number": 74}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/close", {}, ADMIN_HEADERS)
        # creating season 75 makes it the current (upcoming) season
        await execute_post_request(SEASONS_URL, {"number": 75}, ADMIN_HEADERS)
        # reopening the closed s1 must be rejected while another non-ended season exists
        response = await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/open", {}, ADMIN_HEADERS)
        assert response.status_code == 409


class TestCloseSeason:
    @pytest.mark.anyio
    async def test_close_sets_status_ended(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 80}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/close", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "ended"

    @pytest.mark.anyio
    async def test_close_unknown_season_returns_404(self, admin_in_db):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/close", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404


class TestRevertSeason:
    @pytest.mark.anyio
    async def test_revert_ended_to_preseason(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 120}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/close", {}, ADMIN_HEADERS)
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/revert", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "upcoming"

    @pytest.mark.anyio
    async def test_revert_upcoming_returns_409(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 121}, ADMIN_HEADERS)).json()
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/revert", {}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_revert_active_returns_409(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 122}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/revert", {}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_revert_rejected_when_another_current_exists(self, admin_in_db):
        s1 = (await execute_post_request(SEASONS_URL, {"number": 123}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/close", {}, ADMIN_HEADERS)
        # creating season 124 makes it the current (upcoming) season
        await execute_post_request(SEASONS_URL, {"number": 124}, ADMIN_HEADERS)
        response = await execute_patch_request(
            f"{SEASONS_URL}/{s1['id']}/revert", {}, ADMIN_HEADERS
        )
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_revert_unknown_season_returns_404(self, admin_in_db):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/revert", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_revert_non_admin_returns_403(self):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/revert", {}, USER_HEADERS
        )
        assert response.status_code == 403


class TestGetCurrentSeason:
    @pytest.fixture()
    async def user_in_db(self):
        await load_objects([get_generic_user(is_base_id=True)])

    @pytest.mark.anyio
    async def test_returns_null_when_no_season(self, user_in_db):
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.anyio
    async def test_returns_upcoming_season(self, admin_in_db):
        await execute_post_request(SEASONS_URL, {"number": 90}, ADMIN_HEADERS)
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json()["number"] == 90
        assert response.json()["status"] == "upcoming"

    @pytest.mark.anyio
    async def test_preseason_big_thing_returns_correct_limits(self, admin_in_db):
        await execute_post_request(
            SEASONS_URL, {"number": 91, "format": "big_thing"}, ADMIN_HEADERS
        )
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "big_thing"
        assert data["node_count"] == 10

    @pytest.mark.anyio
    async def test_ignores_ended_season(self, admin_in_db):
        s = (await execute_post_request(SEASONS_URL, {"number": 92}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/open", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/close", {}, ADMIN_HEADERS)
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

        response = await execute_get_request("/seasons", USER_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["number"] == 10

    @pytest.mark.anyio
    async def test_non_member_gets_403(self, user_in_db):
        response = await execute_get_request("/seasons", USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_unauthenticated_gets_401(self):
        response = await execute_get_request("/seasons", {})
        assert response.status_code == 401
