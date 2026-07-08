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
from tests.utils.utils_constant import USER_ID, USER2_ID, ALLIANCE_TAG
from tests.utils.utils_db import get_test_session, load_objects
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
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
    async def test_get_player_seasons_includes_assist_only_season(self):
        """A season where the account only assisted (never attacked) must still show up."""
        data = await _setup_with_ended_season_war()
        await push_user2()
        other_acc = await push_member(data["alliance"], user_id=USER2_ID, game_pseudo="Other")
        other_cu = await push_champion_user(other_acc, data["champ"])
        placement = WarDefensePlacement(
            war_id=data["war"].id,
            battlegroup=1,
            node_number=10,
            champion_id=data["champ"].id,
            stars=7,
            rank=3,
            attacker_champion_user_id=other_cu.id,
            assist_champion_user_id=data["cu"].id,
        )
        await load_objects([placement])

        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_seasons(
                session, owner_user, data["owner"].id
            )
            assert len(result) == 1
            assert result[0].number == 64

    @pytest.mark.anyio
    async def test_get_player_seasons_unknown_account_raises_404(self):
        await load_objects([get_generic_user(is_base_id=True)])
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            with pytest.raises(HTTPException) as exc:
                await PlayerStatsService.get_player_seasons(session, owner_user, uuid.uuid4())
            assert exc.value.status_code == 404


class TestGetPlayerStats:
    @pytest.mark.anyio
    async def test_card_evolution_alliances_specific_season(self):
        data = await _setup_with_ended_season_war()
        # one normal fight with 1 KO, one skipped (not-done) node
        await load_objects(
            [
                WarDefensePlacement(
                    war_id=data["war"].id,
                    battlegroup=1,
                    node_number=10,
                    champion_id=data["champ"].id,
                    stars=7,
                    rank=3,
                    attacker_champion_user_id=data["cu"].id,
                    ko_count=1,
                ),
                WarDefensePlacement(
                    war_id=data["war"].id,
                    battlegroup=1,
                    node_number=11,
                    champion_id=data["champ"].id,
                    stars=7,
                    rank=3,
                    attacker_champion_user_id=data["cu"].id,
                    is_fight_not_done=True,
                ),
            ]
        )
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_stats(
                session, owner_user, data["owner"].id, season_id=data["season"].id
            )
            assert result.card.total_kos == 1
            assert result.card.total_not_fought == 1
            assert result.card.total_fights == 1.0
            assert result.card.wars_participated == 1
            assert len(result.evolution) == 1
            assert result.evolution[0].label == "Enemy"
            assert result.evolution[0].fights == 1.0
            assert result.alliances[0].tag == ALLIANCE_TAG

    @pytest.mark.anyio
    async def test_evolution_labels_by_season_when_all(self):
        data = await _setup_with_ended_season_war()
        await _add_placement(data["war"].id, data["cu"].id, data["champ"].id, node_number=10)
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_stats(
                session, owner_user, data["owner"].id, season_id=None
            )
            assert len(result.evolution) == 1
            assert result.evolution[0].label == "S64"

    @pytest.mark.anyio
    async def test_assist_only_counts_participation_not_kos(self):
        data = await _setup_with_ended_season_war()
        await push_user2()
        other_acc = await push_member(data["alliance"], user_id=USER2_ID, game_pseudo="Other")
        other_cu = await push_champion_user(other_acc, data["champ"])
        await load_objects(
            [
                WarDefensePlacement(
                    war_id=data["war"].id,
                    battlegroup=1,
                    node_number=10,
                    champion_id=data["champ"].id,
                    stars=7,
                    rank=3,
                    attacker_champion_user_id=other_cu.id,
                    assist_champion_user_id=data["cu"].id,
                    ko_count=2,
                )
            ]
        )
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_stats(
                session, owner_user, data["owner"].id, season_id=data["season"].id
            )
            assert result.card.wars_participated == 1
            assert result.card.total_assists == 1
            assert result.card.total_kos == 0
            assert result.evolution == []

    @pytest.mark.anyio
    async def test_empty_when_no_participation(self):
        data = await _setup_with_ended_season_war()
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_stats(
                session, owner_user, data["owner"].id, season_id=data["season"].id
            )
            assert result.card.wars_participated == 0
            assert result.card.total_kos == 0
            assert result.card.ratio == 100
            assert result.evolution == []
            assert result.alliances == []


async def _push_fight_record(
    war, alliance_id, game_account_id, champion, defender_champion, ko_count=0
):
    from src.models.WarFightRecord import WarFightRecord as _WFR

    record = _WFR(
        war_id=war.id,
        alliance_id=alliance_id,
        season_id=war.season_id,
        game_account_id=game_account_id,
        battlegroup=1,
        node_number=1,
        tier=7,
        champion_id=champion.id,
        stars=7,
        rank=3,
        ascension=0,
        is_saga_attacker=False,
        defender_champion_id=defender_champion.id,
        defender_stars=7,
        defender_rank=3,
        defender_ascension=0,
        defender_is_saga_defender=False,
        ko_count=ko_count,
    )
    await load_objects([record])
    return record


class TestGetPlayerChampionUsage:
    @pytest.mark.anyio
    async def test_attacker_usage(self):
        data = await _setup_with_ended_season_war()
        defender = await push_champion(name="Venom", champion_class="Cosmic")
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id, data["champ"], defender
        )
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_champion_usage(
                session, owner_user, data["owner"].id, season_id=data["season"].id
            )
            assert len(result) == 1
            assert result[0].champion_name == "Spider-Man"
            assert result[0].fight_count == 1

    @pytest.mark.anyio
    async def test_defender_perspective(self):
        data = await _setup_with_ended_season_war()
        defender = await push_champion(name="Venom", champion_class="Cosmic")
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id, data["champ"], defender
        )
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            result = await PlayerStatsService.get_player_champion_usage(
                session,
                owner_user,
                data["owner"].id,
                season_id=data["season"].id,
                perspective="defender",
            )
            assert len(result) == 1
            assert result[0].champion_name == "Venom"

    @pytest.mark.anyio
    async def test_season_filter_excludes_other_season(self):
        data = await _setup_with_ended_season_war()
        defender = await push_champion(name="Venom", champion_class="Cosmic")
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id, data["champ"], defender
        )
        # a second season + war with a different attacker champion
        iron = await push_champion(name="IronMan", champion_class="Tech")
        season2 = Season(number=60, status=SeasonStatus.ended)
        war2 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy2",
            created_by_id=data["owner"].id,
            season_id=season2.id,
            status=WarStatus.ended,
        )
        await load_objects([season2, war2])
        await _push_fight_record(war2, data["alliance"].id, data["owner"].id, iron, defender)
        owner_user = get_generic_user(is_base_id=True)

        async for session in get_test_session():
            filtered = await PlayerStatsService.get_player_champion_usage(
                session, owner_user, data["owner"].id, season_id=data["season"].id
            )
            assert {r.champion_name for r in filtered} == {"Spider-Man"}

            all_seasons = await PlayerStatsService.get_player_champion_usage(
                session, owner_user, data["owner"].id, season_id=None
            )
            assert {r.champion_name for r in all_seasons} == {"Spider-Man", "IronMan"}

    @pytest.mark.anyio
    async def test_denies_other_user(self):
        data = await _setup_with_ended_season_war()
        await push_user2()
        other_user = get_generic_user(login="user2", email="user2@gmail.com")
        other_user.id = USER2_ID

        async for session in get_test_session():
            with pytest.raises(HTTPException) as exc:
                await PlayerStatsService.get_player_champion_usage(
                    session, other_user, data["owner"].id
                )
            assert exc.value.status_code == 404
