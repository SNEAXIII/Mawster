"""Unit tests for ClosedWarPolicy — running vs closed War rules, no DB."""

import uuid

import pytest
from fastapi import HTTPException

from src.enums.WarStatus import WarStatus
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
