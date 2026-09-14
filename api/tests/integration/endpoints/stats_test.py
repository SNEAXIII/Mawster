"""Integration tests for the public stats service."""

import pytest

from main import app
from src.services.StatsService import StatsService
from src.utils.db import get_session
from tests.integration.endpoints.setup.fight_record_setup import (
    push_ended_war,
    push_fight_record,
)
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import execute_get_request
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

STATS_URL = "/stats/public"


class TestStatsService:
    @pytest.mark.anyio
    async def test_counts_zero_on_empty_db(self):
        async for session in get_test_session():
            result = await StatsService.get_public_stats(session)
            break
        else:
            pytest.fail("get_test_session yielded no session")
        assert result.active_alliances == 0
        assert result.participating_players == 0
        assert result.knowledge_base_fights == 0
        assert result.wars_recorded == 0


class TestPublicStatsCountFights:
    @pytest.mark.anyio
    async def test_counts_one_fight_and_its_player(self):
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
        attacker = await push_champion(name="Spider-Man", champion_class="Science")
        defender = await push_champion(name="Venom", champion_class="Cosmic")
        cu = await push_champion_user(owner, attacker)
        war = await push_ended_war(alliance.id, owner.id)
        await push_fight_record(war, cu, defender)

        async for session in get_test_session():
            result = await StatsService.get_public_stats(session)
            break
        assert result.participating_players == 1
        assert result.knowledge_base_fights == 1


class TestPublicStatsEndpoint:
    @pytest.mark.anyio
    async def test_returns_200_without_auth(self):
        response = await execute_get_request(STATS_URL)  # no headers = unauthenticated
        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_response_shape(self):
        response = await execute_get_request(STATS_URL)
        data = response.json()
        assert set(data.keys()) == {
            "active_alliances",
            "participating_players",
            "knowledge_base_fights",
            "wars_recorded",
        }
        assert all(isinstance(data[k], int) for k in data)
