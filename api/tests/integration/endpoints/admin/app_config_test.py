"""Integration tests for AppConfig admin endpoints."""

import uuid
import pytest
from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_put_request,
    execute_post_request,
)
from tests.utils.utils_db import get_test_session, load_objects
from tests.utils.utils_constant import USER_ID
from tests.integration.endpoints.setup.user_setup import get_admin

app.dependency_overrides[get_session] = get_test_session
ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)

CONFIG_URL = "/admin/config"


@pytest.fixture()
async def admin_in_db():
    await load_objects([get_admin()])


class TestGetConfig:
    @pytest.mark.anyio
    async def test_default_config_has_null_season_and_false_big_thing(self, admin_in_db):
        response = await execute_get_request(CONFIG_URL, ADMIN_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["current_season_id"] is None
        assert data["off_season_big_thing"] is False

    @pytest.mark.anyio
    async def test_non_admin_returns_403(self):
        response = await execute_get_request(CONFIG_URL, USER_HEADERS)
        assert response.status_code == 403


class TestSetCurrentSeason:
    @pytest.mark.anyio
    async def test_set_current_season_to_existing_season(self, admin_in_db):
        season_resp = await execute_post_request("/admin/seasons", {"number": 1}, ADMIN_HEADERS)
        season_id = season_resp.json()["id"]
        response = await execute_put_request(
            f"{CONFIG_URL}/current-season", {"season_id": season_id}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["current_season_id"] == season_id

    @pytest.mark.anyio
    async def test_set_current_season_to_null_goes_off_season(self, admin_in_db):
        response = await execute_put_request(
            f"{CONFIG_URL}/current-season", {"season_id": None}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["current_season_id"] is None

    @pytest.mark.anyio
    async def test_set_unknown_season_returns_404(self, admin_in_db):
        response = await execute_put_request(
            f"{CONFIG_URL}/current-season",
            {"season_id": str(uuid.uuid4())},
            ADMIN_HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_non_admin_returns_403(self):
        response = await execute_put_request(
            f"{CONFIG_URL}/current-season", {"season_id": None}, USER_HEADERS
        )
        assert response.status_code == 403


class TestSetOffSeasonBigThing:
    @pytest.mark.anyio
    async def test_enable_off_season_big_thing(self, admin_in_db):
        response = await execute_put_request(
            f"{CONFIG_URL}/off-season-big-thing", {"enabled": True}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["off_season_big_thing"] is True

    @pytest.mark.anyio
    async def test_disable_off_season_big_thing(self, admin_in_db):
        response = await execute_put_request(
            f"{CONFIG_URL}/off-season-big-thing", {"enabled": False}, ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["off_season_big_thing"] is False

    @pytest.mark.anyio
    async def test_non_admin_returns_403(self):
        response = await execute_put_request(
            f"{CONFIG_URL}/off-season-big-thing", {"enabled": True}, USER_HEADERS
        )
        assert response.status_code == 403
