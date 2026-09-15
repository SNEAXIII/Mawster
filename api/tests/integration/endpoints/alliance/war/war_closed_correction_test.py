"""A closed War: its terms are sealed, its map stays correctable during the Latest Season."""

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from src.enums.SeasonStatus import SeasonStatus
from src.models.war.Season import Season
from tests.integration.endpoints.setup.game_setup import push_strategist
from tests.integration.endpoints.setup.war_setup import _setup_closed_war_scenario
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_patch_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import load_objects, sqlite_async_engine

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))


async def _end_season(season: Season) -> None:
    async with AsyncSession(sqlite_async_engine) as session:
        db_season = await session.get(Season, season.id)
        db_season.status = SeasonStatus.ended
        session.add(db_season)
        await session.commit()


async def _replace_latest_season(season: Season) -> None:
    await _end_season(season)
    await load_objects([Season(number=season.number + 1, status=SeasonStatus.active)])


class TestClosedWarTermsAreSealed:
    @pytest.mark.asyncio
    async def test_update_war_conflicts(self):
        data = await _setup_closed_war_scenario()
        response = await execute_patch_request(
            data["base"],
            payload={"opponent_name": "Renamed", "banned_champion_ids": []},
            headers=OWNER,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_clear_bg_conflicts(self):
        data = await _setup_closed_war_scenario()
        response = await execute_delete_request(f"{data['base']}/bg/1/clear", headers=OWNER)
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_opponent_deaths_stays_editable(self):
        data = await _setup_closed_war_scenario()
        response = await execute_patch_request(
            f"{data['base']}/opponent-deaths", payload={"opponent_deaths": 12}, headers=OWNER
        )
        assert response.status_code == 200


class TestClosedWarMapAccess:
    @pytest.mark.asyncio
    async def test_officer_corrects_ko(self):
        data = await _setup_closed_war_scenario()
        response = await execute_patch_request(
            f"{data['base']}/bg/1/node/10/ko", payload={"ko_count": 2}, headers=OWNER
        )
        assert response.status_code == 200
        assert response.json()["ko_count"] == 2

    @pytest.mark.asyncio
    async def test_strategist_corrects_ko(self):
        data = await _setup_closed_war_scenario()
        await push_strategist(data["alliance"], data["member"])
        response = await execute_patch_request(
            f"{data['base']}/bg/1/node/10/ko", payload={"ko_count": 1}, headers=MEMBER
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_plain_member_is_read_only(self):
        data = await _setup_closed_war_scenario()
        response = await execute_patch_request(
            f"{data['base']}/bg/1/node/10/ko", payload={"ko_count": 1}, headers=MEMBER
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_map_sealed_once_next_season_goes_live(self):
        data = await _setup_closed_war_scenario()
        await _replace_latest_season(data["season"])
        response = await execute_patch_request(
            f"{data['base']}/bg/1/node/10/ko", payload={"ko_count": 1}, headers=OWNER
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_map_still_correctable_while_next_season_is_upcoming(self):
        data = await _setup_closed_war_scenario()
        await _end_season(data["season"])
        await load_objects([Season(number=2, status=SeasonStatus.upcoming)])
        response = await execute_patch_request(
            f"{data['base']}/bg/1/node/10/ko", payload={"ko_count": 1}, headers=OWNER
        )
        assert response.status_code == 200
