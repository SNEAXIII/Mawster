"""Integration tests for SeasonService.get_display_season."""

import pytest

from src.enums.SeasonStatus import SeasonStatus
from src.models.Season import Season
from src.services.SeasonService import SeasonService
from tests.utils.utils_db import load_objects


class TestGetDisplaySeason:
    @pytest.mark.anyio
    async def test_returns_active_when_present(self, session):
        await load_objects(
            [
                Season(number=63, status=SeasonStatus.ended),
                Season(number=64, status=SeasonStatus.active),
                Season(number=65, status=SeasonStatus.upcoming),
            ]
        )
        result = await SeasonService.get_display_season(session)
        assert result is not None
        assert result.number == 64
        assert result.status == SeasonStatus.active

    @pytest.mark.anyio
    async def test_falls_back_to_latest_ended_when_no_active(self, session):
        # Pre-season: no active, an upcoming, several ended
        await load_objects(
            [
                Season(number=62, status=SeasonStatus.ended),
                Season(number=63, status=SeasonStatus.ended),
                Season(number=64, status=SeasonStatus.upcoming),
            ]
        )
        result = await SeasonService.get_display_season(session)
        assert result is not None
        assert result.number == 63
        assert result.status == SeasonStatus.ended

    @pytest.mark.anyio
    async def test_returns_none_when_no_active_and_no_ended(self, session):
        await load_objects([Season(number=64, status=SeasonStatus.upcoming)])
        result = await SeasonService.get_display_season(session)
        assert result is None

    @pytest.mark.anyio
    async def test_returns_none_when_no_seasons(self, session):
        result = await SeasonService.get_display_season(session)
        assert result is None
