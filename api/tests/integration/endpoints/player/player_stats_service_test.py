"""Integration tests for PlayerStatsService (ownership check + seasons list)."""

import uuid
import pytest
from fastapi import HTTPException

from main import app
from src.services.PlayerStatsService import PlayerStatsService
from src.models.Season import Season
from src.enums.SeasonStatus import SeasonStatus
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.utils.db import get_session
from tests.utils.utils_constant import USER_ID, USER2_ID
from tests.utils.utils_db import get_test_session, load_objects
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2

app.dependency_overrides[get_session] = get_test_session


async def _base_setup():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
    champ = await push_champion(name="Spider-Man", champion_class="Science")
    return {"alliance": alliance, "owner": owner, "champ": champ}


async def _setup_with_ended_season_war(number: int = 64, status: SeasonStatus = SeasonStatus.ended):
    data = await _base_setup()
    season = Season(number=number, status=status)
    war = War(
        id=uuid.uuid4(),
        alliance_id=data["alliance"].id,
        opponent_name="Enemy",
        created_by_id=data["owner"].id,
        season_id=season.id,
        status=WarStatus.ended,
    )
    await load_objects([season, war])
    cu = await push_champion_user(data["owner"], data["champ"])
    return {**data, "season": season, "war": war, "cu": cu}


async def _add_placement(war_id, champion_user_id, champion_id, node_number, battlegroup=1):
    placement = WarDefensePlacement(
        war_id=war_id,
        battlegroup=battlegroup,
        node_number=node_number,
        champion_id=champion_id,
        stars=7,
        rank=3,
        attacker_champion_user_id=champion_user_id,
    )
    await load_objects([placement])
    return placement


class TestAssertCanViewAccount:
    @pytest.mark.anyio
    async def test_assert_can_view_account_denies_other_user(self):
        data = await _base_setup()
        await push_user2()
        other_user = get_generic_user(login="user2", email="user2@gmail.com")
        other_user.id = USER2_ID

        async for session in get_test_session():
            with pytest.raises(HTTPException) as exc:
                await PlayerStatsService.assert_can_view_account(
                    session, other_user, data["owner"].id
                )
            assert exc.value.status_code == 404


class TestGetPlayerSeasons:
    @pytest.mark.anyio
    async def test_get_player_seasons_returns_played_seasons(self):
        data = await _setup_with_ended_season_war()
        await _add_placement(data["war"].id, data["cu"].id, data["champ"].id, node_number=10)

        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_seasons(
                session, owner_user, data["owner"].id
            )
            assert len(result) == 1
            assert result[0].number == 64

    @pytest.mark.anyio
    async def test_get_player_seasons_denies_other_user(self):
        data = await _setup_with_ended_season_war()
        await _add_placement(data["war"].id, data["cu"].id, data["champ"].id, node_number=10)
        await push_user2()
        other_user = get_generic_user(login="user2", email="user2@gmail.com")
        other_user.id = USER2_ID

        async for session in get_test_session():
            with pytest.raises(HTTPException) as exc:
                await PlayerStatsService.get_player_seasons(session, other_user, data["owner"].id)
            assert exc.value.status_code == 404

    @pytest.mark.anyio
    async def test_get_player_seasons_returns_empty_when_no_wars(self):
        data = await _base_setup()
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_seasons(
                session, owner_user, data["owner"].id
            )
            assert result == []

    @pytest.mark.anyio
    async def test_get_player_seasons_orders_by_number_desc(self):
        data = await _base_setup()

        season1 = Season(number=60, status=SeasonStatus.ended)
        war1 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy1",
            created_by_id=data["owner"].id,
            season_id=season1.id,
            status=WarStatus.ended,
        )
        season2 = Season(number=64, status=SeasonStatus.ended)
        war2 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy2",
            created_by_id=data["owner"].id,
            season_id=season2.id,
            status=WarStatus.ended,
        )
        await load_objects([season1, war1, season2, war2])
        cu = await push_champion_user(data["owner"], data["champ"])
        await _add_placement(war1.id, cu.id, data["champ"].id, node_number=10)
        await _add_placement(war2.id, cu.id, data["champ"].id, node_number=10)

        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_seasons(
                session, owner_user, data["owner"].id
            )
            assert [s.number for s in result] == [64, 60]

    @pytest.mark.anyio
    async def test_get_player_seasons_ignores_active_war(self):
        data = await _base_setup()
        season = Season(number=64, status=SeasonStatus.active)
        active_war = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy",
            created_by_id=data["owner"].id,
            season_id=season.id,
            status=WarStatus.active,
        )
        await load_objects([season, active_war])
        cu = await push_champion_user(data["owner"], data["champ"])
        await _add_placement(active_war.id, cu.id, data["champ"].id, node_number=10)

        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_seasons(
                session, owner_user, data["owner"].id
            )
            assert result == []

    @pytest.mark.anyio
    async def test_get_player_seasons_unknown_account_raises_404(self):
        await load_objects([get_generic_user(is_base_id=True)])
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            with pytest.raises(HTTPException) as exc:
                await PlayerStatsService.get_player_seasons(session, owner_user, uuid.uuid4())
            assert exc.value.status_code == 404
