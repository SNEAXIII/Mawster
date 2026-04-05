import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_admin, push_one_user
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.utils.utils_client import (
    create_auth_headers,
    execute_patch_request,
    execute_get_request,
)
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)


class TestChampionPrefightEndpoint:
    @pytest.mark.asyncio
    async def test_admin_can_toggle_false_to_true(self, session):
        await push_one_admin()
        champ = await push_champion("Spider-Man", "Science", has_prefight=False)

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/prefight",
            payload=None,
            headers=ADMIN_HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["has_prefight"] is True

        get_resp = await execute_get_request(
            f"/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["has_prefight"] is True

    @pytest.mark.asyncio
    async def test_admin_can_toggle_true_to_false(self, session):
        await push_one_admin()
        champ = await push_champion("Hercules", "Cosmic", has_prefight=True)

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/prefight",
            payload=None,
            headers=ADMIN_HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["has_prefight"] is False

        get_resp = await execute_get_request(
            f"/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["has_prefight"] is False

    @pytest.mark.asyncio
    async def test_non_admin_is_forbidden(self, session):
        await push_one_user()
        champ = await push_champion("Wolverine", "Mutant")

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/prefight",
            payload=None,
            headers=USER_HEADERS,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_is_401(self, session):
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/prefight",
            payload=None,
            headers=None,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unknown_champion_is_404(self, session):
        await push_one_admin()

        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/prefight",
            payload=None,
            headers=ADMIN_HEADERS,
        )

        assert response.status_code == 404
