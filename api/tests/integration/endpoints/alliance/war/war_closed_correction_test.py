"""A closed War: its terms are sealed, its map stays correctable during the Latest Season."""

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.enums.SeasonStatus import SeasonStatus
from src.models.champion.ChampionUser import ChampionUser
from src.models.war.Season import Season
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightRecord import WarFightRecord
from tests.integration.endpoints.setup.game_setup import (
    push_champion,
    push_champion_user,
    push_strategist,
)
from tests.integration.endpoints.setup.war_setup import (
    _setup_attacker_scenario,
    _setup_closed_war_scenario,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_patch_request,
    execute_post_request,
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


async def _record_of_node(war_id, battlegroup: int, node: int) -> WarFightRecord | None:
    async with AsyncSession(sqlite_async_engine) as session:
        return (
            await session.exec(
                select(WarFightRecord)
                .join(
                    WarDefensePlacement,
                    WarFightRecord.war_defense_placement_id == WarDefensePlacement.id,
                )
                .where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node,
                )
            )
        ).first()


async def _placement_id_of_node(war_id, battlegroup: int, node: int):
    async with AsyncSession(sqlite_async_engine) as session:
        return (
            await session.exec(
                select(WarDefensePlacement.id).where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node,
                )
            )
        ).first()


async def _record_by_placement_id(placement_id) -> WarFightRecord | None:
    """No join through the placement: SQLite in tests never enables foreign_keys,
    so a deleted placement would otherwise leave an orphaned record invisible."""
    async with AsyncSession(sqlite_async_engine) as session:
        return (
            await session.exec(
                select(WarFightRecord).where(
                    WarFightRecord.war_defense_placement_id == placement_id
                )
            )
        ).first()


class TestClosedWarFightRecordSync:
    @pytest.mark.asyncio
    async def test_changing_attacker_refreezes_current_stats(self):
        data = await _setup_closed_war_scenario()
        other = await push_champion(name="Hulk", champion_class="Science")
        cu = await push_champion_user(data["member"], other, stars=7, rank=5)
        response = await execute_post_request(
            f"{data['base']}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(cu.id)},
            headers=OWNER,
        )
        assert response.status_code == 200
        record = await _record_of_node(data["war"].id, 1, 10)
        assert record is not None
        assert record.rank == 5

    @pytest.mark.asyncio
    async def test_removing_attacker_drops_record(self):
        data = await _setup_closed_war_scenario()
        response = await execute_delete_request(
            f"{data['base']}/bg/1/node/10/attacker", headers=OWNER
        )
        assert response.status_code == 200
        assert await _record_of_node(data["war"].id, 1, 10) is None

    @pytest.mark.asyncio
    async def test_fight_not_done_toggles_record(self):
        data = await _setup_closed_war_scenario()
        url = f"{data['base']}/bg/1/node/10/fight-not-done"
        assert (await execute_patch_request(url, {}, headers=OWNER)).status_code == 200
        assert await _record_of_node(data["war"].id, 1, 10) is None
        assert (await execute_patch_request(url, {}, headers=OWNER)).status_code == 200
        assert await _record_of_node(data["war"].id, 1, 10) is not None

    @pytest.mark.asyncio
    async def test_removing_defender_drops_record(self):
        data = await _setup_closed_war_scenario()
        placement_id = await _placement_id_of_node(data["war"].id, 1, 10)
        response = await execute_delete_request(f"{data['base']}/bg/1/node/10", headers=OWNER)
        assert response.status_code == 204
        assert await _record_by_placement_id(placement_id) is None

    @pytest.mark.asyncio
    async def test_replacing_defender_drops_old_record(self):
        data = await _setup_closed_war_scenario()
        old_placement_id = await _placement_id_of_node(data["war"].id, 1, 10)
        champ = await push_champion(name="Iron Man", champion_class="Tech")
        response = await execute_post_request(
            f"{data['base']}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(champ.id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=OWNER,
        )
        assert response.status_code == 201
        assert await _record_by_placement_id(old_placement_id) is None

    @pytest.mark.asyncio
    async def test_reassigning_same_attacker_keeps_old_rank(self):
        data = await _setup_closed_war_scenario()
        async with AsyncSession(sqlite_async_engine) as session:
            cu = await session.get(ChampionUser, data["champion_user"].id)
            cu.rank = 6
            session.add(cu)
            await session.commit()
        response = await execute_post_request(
            f"{data['base']}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=OWNER,
        )
        assert response.status_code == 200
        record = await _record_of_node(data["war"].id, 1, 10)
        assert record is not None
        assert record.rank == 3

    @pytest.mark.asyncio
    async def test_assigning_attacker_on_running_war_creates_no_record(self):
        data = await _setup_attacker_scenario()
        base = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}"
        response = await execute_post_request(
            f"{base}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=OWNER,
        )
        assert response.status_code == 200
        assert await _record_of_node(data["war"].id, 1, 10) is None
