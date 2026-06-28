"""Integration tests for the public stats service."""

import pytest

from main import app
from src.models import War, WarFightRecord  # noqa: F401
from src.services.StatsService import StatsService
from src.utils.db import get_session
from tests.utils.utils_client import execute_get_request
from tests.utils.utils_db import get_test_session

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
