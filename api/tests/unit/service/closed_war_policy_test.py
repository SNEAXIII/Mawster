"""Unit tests for ClosedWarPolicy — running vs closed War rules, no DB."""

import uuid

import pytest
from fastapi import HTTPException

from src.enums.SeasonStatus import SeasonStatus
from src.enums.WarStatus import WarStatus
from src.models.war.Season import Season
from src.models.war.War import War
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
