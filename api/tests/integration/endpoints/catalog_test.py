"""Integration tests for the public /catalog endpoints."""

import uuid

import pytest

from main import app
from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.models.champion.ChampionSagaRole import ChampionSagaRole
from src.models.war.Season import Season
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.utils.utils_client import execute_get_request
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

CATALOG_URL = "/catalog/champions"
SEASONS_URL = "/catalog/seasons"


async def _season_with_roles(
    champion_id: uuid.UUID, number: int, status: SeasonStatus, *, attacker: bool, defender: bool
) -> None:
    season = Season(number=number, status=status)
    await load_objects([season])
    await load_objects(
        [
            ChampionSagaRole(
                season_id=season.id,
                champion_id=champion_id,
                is_saga_attacker=attacker,
                is_saga_defender=defender,
            )
        ]
    )


class TestGetChampionCatalog:
    @pytest.mark.anyio
    async def test_empty_catalog_returns_no_champions(self):
        response = await execute_get_request(CATALOG_URL)

        assert response.status_code == 200
        data = response.json()
        assert data["champions"] == []
        assert data["season_number"] is None

    @pytest.mark.anyio
    async def test_returns_every_champion_without_a_token(self):
        await push_champion(name="Spider-Man")
        await push_champion(name="Doctor Doom")

        response = await execute_get_request(CATALOG_URL)

        assert response.status_code == 200
        data = response.json()
        assert len(data["champions"]) == 2
        assert {c["name"] for c in data["champions"]} == {"Spider-Man", "Doctor Doom"}

    @pytest.mark.anyio
    async def test_no_season_running_leaves_season_null_and_saga_flags_false(self):
        await push_champion(name="Spider-Man")

        response = await execute_get_request(CATALOG_URL)

        data = response.json()
        assert data["season_number"] is None
        assert data["champions"][0]["is_saga_attacker"] is False
        assert data["champions"][0]["is_saga_defender"] is False

    @pytest.mark.anyio
    async def test_carries_saga_roles_from_the_current_season(self):
        champion = await push_champion(name="Spider-Man")
        await _season_with_roles(
            champion.id, 42, SeasonStatus.ACTIVE, attacker=True, defender=False
        )

        response = await execute_get_request(CATALOG_URL)

        data = response.json()
        assert data["season_number"] == 42
        champ = next(c for c in data["champions"] if c["id"] == str(champion.id))
        assert champ["is_saga_attacker"] is True
        assert champ["is_saga_defender"] is False

    @pytest.mark.anyio
    async def test_ignores_saga_roles_from_an_ended_season(self):
        champion = await push_champion(name="Spider-Man")
        await _season_with_roles(champion.id, 41, SeasonStatus.ENDED, attacker=True, defender=True)

        response = await execute_get_request(CATALOG_URL)

        data = response.json()
        assert data["season_number"] is None
        champ = next(c for c in data["champions"] if c["id"] == str(champion.id))
        assert champ["is_saga_attacker"] is False
        assert champ["is_saga_defender"] is False

    @pytest.mark.anyio
    async def test_explicit_season_carries_its_own_saga_roles(self):
        champion = await push_champion(name="Spider-Man")
        await _season_with_roles(champion.id, 41, SeasonStatus.ENDED, attacker=False, defender=True)
        await _season_with_roles(
            champion.id, 42, SeasonStatus.ACTIVE, attacker=True, defender=False
        )

        response = await execute_get_request(f"{CATALOG_URL}?season_number=41")

        data = response.json()
        assert data["season_number"] == 41
        assert data["champions"][0]["is_saga_attacker"] is False
        assert data["champions"][0]["is_saga_defender"] is True

    @pytest.mark.anyio
    async def test_unknown_season_number_returns_404(self):
        response = await execute_get_request(f"{CATALOG_URL}?season_number=99")

        assert response.status_code == 404


class TestGetCatalogSeasons:
    @pytest.mark.anyio
    async def test_lists_regular_seasons_newest_first_without_a_token(self):
        await load_objects(
            [
                Season(number=40, status=SeasonStatus.ENDED),
                Season(number=41, status=SeasonStatus.ENDED, format=SeasonFormat.BIG_THING),
                Season(number=42, status=SeasonStatus.UPCOMING),
            ]
        )

        response = await execute_get_request(SEASONS_URL)

        assert response.status_code == 200
        assert response.json() == [
            {"number": 42, "status": "upcoming"},
            {"number": 40, "status": "ended"},
        ]
