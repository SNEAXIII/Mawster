"""Unit tests for ClosedWarPolicy — running vs closed War rules, no DB."""

import uuid

import pytest
from fastapi import HTTPException

from src.enums.SeasonStatus import SeasonStatus
from src.enums.WarStatus import WarStatus
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.services.alliance.war.ClosedWarPolicy import ClosedWarPolicy


def _war(status: WarStatus, season_id: uuid.UUID | None = None) -> War:
    return War(
        alliance_id=uuid.uuid4(),
        opponent_name="Enemy",
        created_by_id=uuid.uuid4(),
        status=status,
        season_id=season_id,
    )


class TestAssertOpen:
    def test_running_war_passes(self):
        ClosedWarPolicy.assert_open(_war(WarStatus.active))

    def test_closed_war_conflicts(self):
        war = _war(WarStatus.ended)
        with pytest.raises(HTTPException) as exc:
            ClosedWarPolicy.assert_open(war)
        assert exc.value.status_code == 409


class TestIsMapCorrectable:
    def test_running_war_is_always_correctable(self):
        assert ClosedWarPolicy.is_map_correctable(_war(WarStatus.active), None)

    def test_closed_war_of_latest_season_is_correctable(self):
        season = Season(id=uuid.uuid4(), number=12, status=SeasonStatus.ended)
        assert ClosedWarPolicy.is_map_correctable(_war(WarStatus.ended, season.id), season)

    def test_closed_war_of_older_season_is_sealed(self):
        latest = Season(id=uuid.uuid4(), number=13, status=SeasonStatus.active)
        assert not ClosedWarPolicy.is_map_correctable(_war(WarStatus.ended, uuid.uuid4()), latest)

    def test_closed_off_season_war_is_sealed(self):
        latest = Season(id=uuid.uuid4(), number=12, status=SeasonStatus.active)
        assert not ClosedWarPolicy.is_map_correctable(_war(WarStatus.ended, None), latest)

    def test_closed_war_without_any_season_is_sealed(self):
        assert not ClosedWarPolicy.is_map_correctable(_war(WarStatus.ended, uuid.uuid4()), None)


def _fought_node(war: War, alliance_id, group: int | None) -> WarDefensePlacement:
    account = GameAccount(
        user_id=uuid.uuid4(), game_pseudo="Bob", alliance_id=alliance_id, alliance_group=group
    )
    attacker = ChampionUser(game_account_id=account.id, champion_id=uuid.uuid4(), stars=7, rank=3)
    attacker.game_account = account
    placement = WarDefensePlacement(
        war_id=war.id, battlegroup=2, node_number=12, champion_id=uuid.uuid4(), stars=7, rank=3
    )
    placement.attacker_champion_user = attacker
    return placement


class TestIsAttackerLocked:
    def test_running_war_never_locks(self):
        war = _war(WarStatus.active)
        assert not ClosedWarPolicy.is_attacker_locked(war, _fought_node(war, None, None))

    def test_closed_war_player_still_in_battlegroup(self):
        war = _war(WarStatus.ended)
        assert not ClosedWarPolicy.is_attacker_locked(war, _fought_node(war, war.alliance_id, 2))

    def test_closed_war_player_moved_battlegroup(self):
        war = _war(WarStatus.ended)
        assert ClosedWarPolicy.is_attacker_locked(war, _fought_node(war, war.alliance_id, 3))

    def test_closed_war_player_left_alliance(self):
        war = _war(WarStatus.ended)
        assert ClosedWarPolicy.is_attacker_locked(war, _fought_node(war, None, None))

    def test_node_without_attacker(self):
        war = _war(WarStatus.ended)
        placement = WarDefensePlacement(
            war_id=war.id, battlegroup=2, node_number=1, champion_id=uuid.uuid4(), stars=7, rank=3
        )
        assert not ClosedWarPolicy.is_attacker_locked(war, placement)
