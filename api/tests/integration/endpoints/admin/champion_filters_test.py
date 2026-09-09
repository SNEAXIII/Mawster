"""Filtering and ordering on GET /champions.

The saga cases matter most: the listing outer-joins ChampionSagaRole, so a champion
with no role row for the season must still be returned and must count as "not
attacker, not defender". A plain join would drop those champions silently.
"""

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.integration.endpoints.setup.user_setup import push_one_admin
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
CHAMPIONS_URL = "/champions"
SEASONS_URL = "/admin/seasons"


async def _names(url: str) -> list[str]:
    response = await execute_get_request(url, headers=ADMIN_HEADERS)
    assert response.status_code == 200
    return [c["name"] for c in response.json()["champions"]]


async def _make_season(number: int) -> str:
    response = await execute_post_request(SEASONS_URL, {"number": number}, ADMIN_HEADERS)
    assert response.status_code == 201
    return response.json()["id"]


class TestSevenStarsFilter:
    @pytest.mark.asyncio
    async def test_filters_available(self, session):
        await push_one_admin()
        await push_champion("Hercules", "Cosmic", is_7_stars_available=True)
        await push_champion("Storm", "Mutant", is_7_stars_available=False)

        assert await _names(f"{CHAMPIONS_URL}?is_7_stars_available=true") == ["Hercules"]

    @pytest.mark.asyncio
    async def test_filters_unavailable(self, session):
        await push_one_admin()
        await push_champion("Hercules", "Cosmic", is_7_stars_available=True)
        await push_champion("Storm", "Mutant", is_7_stars_available=False)

        assert await _names(f"{CHAMPIONS_URL}?is_7_stars_available=false") == ["Storm"]


class TestSagaFilters:
    @pytest.mark.asyncio
    async def test_attacker_true_returns_only_flagged(self, session):
        await push_one_admin()
        season_id = await _make_season(901)
        attacker = await push_champion("Hercules", "Cosmic")
        await push_champion("Storm", "Mutant")
        await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{attacker.id}",
            {"is_saga_attacker": True, "is_saga_defender": False},
            ADMIN_HEADERS,
        )

        url = f"{CHAMPIONS_URL}?season_id={season_id}&is_saga_attacker=true"
        assert await _names(url) == ["Hercules"]

    @pytest.mark.asyncio
    async def test_attacker_false_includes_champions_without_a_role_row(self, session):
        """The outer-join case: Storm has no ChampionSagaRole row at all."""
        await push_one_admin()
        season_id = await _make_season(902)
        attacker = await push_champion("Hercules", "Cosmic")
        await push_champion("Storm", "Mutant")
        await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{attacker.id}",
            {"is_saga_attacker": True, "is_saga_defender": False},
            ADMIN_HEADERS,
        )

        url = f"{CHAMPIONS_URL}?season_id={season_id}&is_saga_attacker=false"
        assert await _names(url) == ["Storm"]

    @pytest.mark.asyncio
    async def test_roles_of_another_season_do_not_leak(self, session):
        await push_one_admin()
        flagged_season = await _make_season(903)
        champ = await push_champion("Hercules", "Cosmic")
        await execute_put_request(
            f"{SEASONS_URL}/{flagged_season}/saga/{champ.id}",
            {"is_saga_attacker": True, "is_saga_defender": False},
            ADMIN_HEADERS,
        )
        # Only one season may be current, so the first is closed before opening the next.
        await execute_patch_request(
            f"{SEASONS_URL}/{flagged_season}/close", payload=None, headers=ADMIN_HEADERS
        )
        other_season = await _make_season(904)

        url = f"{CHAMPIONS_URL}?season_id={other_season}&is_saga_attacker=true"
        assert await _names(url) == []

    @pytest.mark.asyncio
    async def test_season_id_populates_saga_fields(self, session):
        await push_one_admin()
        season_id = await _make_season(905)
        champ = await push_champion("Hercules", "Cosmic")
        await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{champ.id}",
            {"is_saga_attacker": True, "is_saga_defender": True},
            ADMIN_HEADERS,
        )

        response = await execute_get_request(
            f"{CHAMPIONS_URL}?season_id={season_id}", headers=ADMIN_HEADERS
        )
        entry = response.json()["champions"][0]
        assert entry["is_saga_attacker"] is True
        assert entry["is_saga_defender"] is True

    @pytest.mark.asyncio
    async def test_saga_fields_default_false_without_season_id(self, session):
        await push_one_admin()
        season_id = await _make_season(906)
        champ = await push_champion("Hercules", "Cosmic")
        await execute_put_request(
            f"{SEASONS_URL}/{season_id}/saga/{champ.id}",
            {"is_saga_attacker": True, "is_saga_defender": True},
            ADMIN_HEADERS,
        )

        response = await execute_get_request(CHAMPIONS_URL, headers=ADMIN_HEADERS)
        entry = response.json()["champions"][0]
        assert entry["is_saga_attacker"] is False
        assert entry["is_saga_defender"] is False

    @pytest.mark.asyncio
    async def test_saga_filter_without_season_is_422(self, session):
        await push_one_admin()

        response = await execute_get_request(
            f"{CHAMPIONS_URL}?is_saga_attacker=true", headers=ADMIN_HEADERS
        )

        assert response.status_code == 422


class TestOrdering:
    @pytest.mark.asyncio
    async def test_orders_by_name_descending(self, session):
        await push_one_admin()
        await push_champion("Hercules", "Cosmic")
        await push_champion("Storm", "Mutant")

        assert await _names(f"{CHAMPIONS_URL}?order_by=name&order_dir=desc") == [
            "Storm",
            "Hercules",
        ]

    @pytest.mark.asyncio
    async def test_orders_by_class_then_name(self, session):
        await push_one_admin()
        await push_champion("Storm", "Mutant")
        await push_champion("Hercules", "Cosmic")
        await push_champion("Colossus", "Mutant")

        assert await _names(f"{CHAMPIONS_URL}?order_by=champion_class") == [
            "Hercules",
            "Colossus",
            "Storm",
        ]

    @pytest.mark.asyncio
    async def test_rejects_unknown_order_field(self, session):
        await push_one_admin()

        response = await execute_get_request(
            f"{CHAMPIONS_URL}?order_by=alias", headers=ADMIN_HEADERS
        )

        assert response.status_code == 422
