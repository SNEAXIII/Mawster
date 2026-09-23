"""Integration tests for the win streak on the personal stats card."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from main import app
from src.enums.SeasonStatus import SeasonStatus
from src.enums.WarStatus import WarStatus
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.services.PlayerStatsService import PlayerStatsService
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

BASE_DATE = datetime(2026, 1, 1, tzinfo=UTC)


async def _setup(season_number: int = 64):
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
    champ = await push_champion(name="Spider-Man", champion_class="Science")
    cu = await push_champion_user(owner, champ)
    season = Season(number=season_number, status=SeasonStatus.active)
    await load_objects([season])
    return {"alliance": alliance, "owner": owner, "champ": champ, "cu": cu, "season": season}


async def _war(data, hours: int = 0, season_id=None, status=WarStatus.ended, in_season=True):
    war = War(
        id=uuid.uuid4(),
        alliance_id=data["alliance"].id,
        opponent_name=f"Enemy{hours}",
        created_by_id=data["owner"].id,
        season_id=(season_id or data["season"].id) if in_season else None,
        status=status,
        created_at=BASE_DATE + timedelta(hours=hours),
    )
    await load_objects([war])
    return war


async def _fight(data, war, node_number: int, attacker_cu_id=None, **flags):
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=1,
        node_number=node_number,
        champion_id=data["champ"].id,
        stars=7,
        rank=3,
        attacker_champion_user_id=attacker_cu_id or data["cu"].id,
        **flags,
    )
    await load_objects([placement])
    return placement


async def _streak(data, season_id=None) -> int:
    owner_user = get_generic_user(is_base_id=True)
    streaks = [
        (
            await PlayerStatsService.get_player_stats(
                session, owner_user, data["owner"].id, season_id=season_id
            )
        ).card.win_streak
        async for session in get_test_session()
    ]
    return streaks[0]


class TestWinStreakBasics:
    @pytest.mark.anyio
    async def test_no_fight_is_zero(self):
        data = await _setup()
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_clean_nodes_one_two_three_is_three(self):
        data = await _setup()
        war = await _war(data)
        for node in (1, 2, 3):
            await _fight(data, war, node)
        assert await _streak(data) == 3

    @pytest.mark.anyio
    async def test_ko_on_node_two_leaves_one(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(data, war, 2, ko_count=1)
        await _fight(data, war, 3)
        assert await _streak(data) == 1

    @pytest.mark.anyio
    async def test_ko_on_last_node_is_zero(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(data, war, 2)
        await _fight(data, war, 3, ko_count=2)
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_ko_on_first_node_keeps_the_next_ones(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1, ko_count=1)
        await _fight(data, war, 2)
        await _fight(data, war, 3)
        assert await _streak(data) == 2


class TestWinStreakFlags:
    @pytest.mark.anyio
    async def test_not_done_breaks_like_a_ko(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(data, war, 2, is_fight_not_done=True)
        await _fight(data, war, 3)
        assert await _streak(data) == 1

    @pytest.mark.anyio
    async def test_planning_error_is_neutral_even_with_kos(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(data, war, 2, ko_count=3, is_planning_error=True)
        await _fight(data, war, 3)
        assert await _streak(data) == 2

    @pytest.mark.anyio
    async def test_planning_error_only_is_zero(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1, is_planning_error=True)
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_combat_completed_flag_changes_nothing(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1, is_combat_completed=True)
        await _fight(data, war, 2, ko_count=1, is_combat_completed=True)
        await _fight(data, war, 3, is_combat_completed=False)
        assert await _streak(data) == 1


class TestWinStreakScope:
    @pytest.mark.anyio
    async def test_off_season_war_is_ignored(self):
        data = await _setup()
        war = await _war(data, hours=0)
        await _fight(data, war, 1)
        await _fight(data, war, 2)
        off = await _war(data, hours=1, in_season=False)
        await _fight(data, off, 1, ko_count=1)
        await _fight(data, off, 2)
        assert await _streak(data) == 2

    @pytest.mark.anyio
    async def test_off_season_clean_fights_do_not_add(self):
        data = await _setup()
        off = await _war(data, in_season=False)
        for node in (1, 2, 3):
            await _fight(data, off, node)
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_active_war_is_ignored(self):
        data = await _setup()
        ended = await _war(data, hours=0)
        await _fight(data, ended, 1)
        active = await _war(data, hours=1, status=WarStatus.active)
        await _fight(data, active, 1, ko_count=1)
        await _fight(data, active, 2)
        assert await _streak(data) == 1

    @pytest.mark.anyio
    async def test_assist_does_not_count(self):
        data = await _setup()
        await push_user2()
        member = await push_member(data["alliance"], USER2_ID)
        member_cu = await push_champion_user(member, data["champ"])
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(
            data,
            war,
            2,
            attacker_cu_id=member_cu.id,
            assist_champion_user_id=data["cu"].id,
            ko_count=1,
        )
        assert await _streak(data) == 1

    @pytest.mark.anyio
    async def test_other_players_kos_do_not_break_it(self):
        data = await _setup()
        await push_user2()
        member = await push_member(data["alliance"], USER2_ID)
        member_cu = await push_champion_user(member, data["champ"])
        war = await _war(data)
        await _fight(data, war, 1)
        await _fight(data, war, 2, attacker_cu_id=member_cu.id, ko_count=4)
        await _fight(data, war, 3)
        assert await _streak(data) == 2

    @pytest.mark.anyio
    async def test_node_without_attacker_is_ignored(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 1)
        await load_objects(
            [
                WarDefensePlacement(
                    war_id=war.id,
                    battlegroup=1,
                    node_number=2,
                    champion_id=data["champ"].id,
                    stars=7,
                    rank=3,
                    ko_count=1,
                )
            ]
        )
        assert await _streak(data) == 1


class TestWinStreakChronology:
    @pytest.mark.anyio
    async def test_nodes_ordered_by_number_not_insertion(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 3, ko_count=1)
        await _fight(data, war, 1)
        await _fight(data, war, 2)
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_nodes_ordered_numerically_not_lexically(self):
        data = await _setup()
        war = await _war(data)
        await _fight(data, war, 9, ko_count=1)
        await _fight(data, war, 10)
        assert await _streak(data) == 1

    @pytest.mark.anyio
    async def test_wars_ordered_by_date_not_insertion(self):
        data = await _setup()
        later = await _war(data, hours=5)
        await _fight(data, later, 1)
        await _fight(data, later, 2)
        earlier = await _war(data, hours=1)
        await _fight(data, earlier, 40, ko_count=1)
        assert await _streak(data) == 2

    @pytest.mark.anyio
    async def test_ko_in_latest_war_resets_earlier_clean_war(self):
        data = await _setup()
        earlier = await _war(data, hours=1)
        for node in (1, 2, 3):
            await _fight(data, earlier, node)
        later = await _war(data, hours=5)
        await _fight(data, later, 1, ko_count=1)
        assert await _streak(data) == 0

    @pytest.mark.anyio
    async def test_chains_across_wars(self):
        data = await _setup()
        first = await _war(data, hours=0)
        await _fight(data, first, 1, ko_count=1)
        await _fight(data, first, 2)
        await _fight(data, first, 3)
        second = await _war(data, hours=1)
        await _fight(data, second, 1)
        await _fight(data, second, 2)
        assert await _streak(data) == 4

    @pytest.mark.anyio
    async def test_low_node_of_latest_war_comes_after_high_node_of_previous(self):
        data = await _setup()
        first = await _war(data, hours=0)
        await _fight(data, first, 50, ko_count=1)
        second = await _war(data, hours=1)
        await _fight(data, second, 1)
        assert await _streak(data) == 1


class TestWinStreakAcrossSeasons:
    @pytest.mark.anyio
    async def test_chains_across_seasons(self):
        data = await _setup(season_number=63)
        new_season = Season(number=64, status=SeasonStatus.active)
        await load_objects([new_season])
        old = await _war(data, hours=0)
        await _fight(data, old, 1)
        await _fight(data, old, 2)
        new = await _war(data, hours=1, season_id=new_season.id)
        await _fight(data, new, 1)
        assert await _streak(data) == 3

    @pytest.mark.anyio
    async def test_ignores_the_season_filter(self):
        data = await _setup(season_number=63)
        new_season = Season(number=64, status=SeasonStatus.active)
        await load_objects([new_season])
        old = await _war(data, hours=0)
        await _fight(data, old, 1)
        await _fight(data, old, 2)
        new = await _war(data, hours=1, season_id=new_season.id)
        await _fight(data, new, 1, ko_count=1)
        await _fight(data, new, 2)
        assert await _streak(data, season_id=data["season"].id) == 1
        assert await _streak(data, season_id=new_season.id) == 1
        assert await _streak(data) == 1
