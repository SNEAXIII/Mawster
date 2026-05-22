"""Unit tests for resolve_war_config factory."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.alliance.war.WarConfig import (
    BIG_THING_CONFIG,
    NORMAL_WAR_CONFIG,
    resolve_war_config,
)


async def test_normal_season_returns_normal_config():
    war = MagicMock()
    war.season_id = uuid.uuid4()
    season = MagicMock()
    season.is_big_thing = False
    session = AsyncMock()
    session.get = AsyncMock(return_value=season)

    config = await resolve_war_config(war, session)
    assert config == NORMAL_WAR_CONFIG


async def test_big_thing_season_returns_big_thing_config():
    war = MagicMock()
    war.season_id = uuid.uuid4()
    season = MagicMock()
    season.is_big_thing = True
    session = AsyncMock()
    session.get = AsyncMock(return_value=season)

    config = await resolve_war_config(war, session)
    assert config == BIG_THING_CONFIG


async def test_off_season_normal_returns_normal_config():
    war = MagicMock()
    war.season_id = None

    with patch(
        "src.services.admin.AppConfigService.AppConfigService.get_off_season_big_thing",
        new=AsyncMock(return_value=False),
    ):
        config = await resolve_war_config(war, AsyncMock())
    assert config == NORMAL_WAR_CONFIG


async def test_off_season_big_thing_returns_big_thing_config():
    war = MagicMock()
    war.season_id = None

    with patch(
        "src.services.admin.AppConfigService.AppConfigService.get_off_season_big_thing",
        new=AsyncMock(return_value=True),
    ):
        config = await resolve_war_config(war, AsyncMock())
    assert config == BIG_THING_CONFIG


async def test_missing_season_record_returns_normal_config():
    """If season_id references a deleted season, default to normal."""
    war = MagicMock()
    war.season_id = uuid.uuid4()
    session = AsyncMock()
    session.get = AsyncMock(return_value=None)  # season not found

    config = await resolve_war_config(war, session)
    assert config == NORMAL_WAR_CONFIG
