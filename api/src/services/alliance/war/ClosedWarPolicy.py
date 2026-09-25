import uuid

from fastapi import HTTPException
from starlette import status

from src.enums.WarStatus import WarStatus
from src.Messages.war_messages import (
    ATTACKER_LEFT_BATTLEGROUP_LOCKED,
    WAR_CLOSED,
    WAR_MAP_SEALED,
)
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.services.alliance.AllianceService import AllianceService
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep


class ClosedWarPolicy:
    """What a closed War still lets through — see docs/adr/0017."""

    @staticmethod
    def assert_open(war: War) -> None:
        if war.status == WarStatus.ended:
            raise HTTPException(status.HTTP_409_CONFLICT, WAR_CLOSED)

    @staticmethod
    def is_map_correctable(war: War, latest_season: Season | None) -> bool:
        if war.status == WarStatus.active:
            return True
        return latest_season is not None and war.season_id == latest_season.id

    @classmethod
    async def require_map_edit(cls, session: SessionDep, war: War, user_id: uuid.UUID) -> None:
        """Called after the endpoint's own rank check; a closed War adds Strategist+ and the window."""
        if war.status == WarStatus.active:
            return
        await AllianceService.require_strategist(session, war.alliance_id, user_id)
        if not cls.is_map_correctable(war, await SeasonService.get_display_season(session)):
            raise HTTPException(status.HTTP_409_CONFLICT, WAR_MAP_SEALED)

    @staticmethod
    def is_attacker_locked(war: War, placement: WarDefensePlacement) -> bool:
        if war.status != WarStatus.ended or placement.attacker_champion_user is None:
            return False
        account = placement.attacker_champion_user.game_account
        return (
            account.alliance_id != war.alliance_id
            or account.alliance_group != placement.battlegroup
        )

    @classmethod
    def assert_attacker_unlocked(cls, war: War, placement: WarDefensePlacement) -> None:
        if cls.is_attacker_locked(war, placement):
            raise HTTPException(status.HTTP_409_CONFLICT, ATTACKER_LEFT_BATTLEGROUP_LOCKED)
