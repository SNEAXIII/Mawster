import uuid

from fastapi import HTTPException
from starlette import status

from src.enums.WarStatus import WarStatus
from src.Messages.war_messages import WAR_CLOSED, WAR_MAP_SEALED
from src.models.war.Season import Season
from src.models.war.War import War
from src.services.alliance.AllianceService import AllianceService
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep


class ClosedWarPolicy:
    """What a closed War still lets through — see docs/adr/0017."""

    @staticmethod
    def assert_open(war: War) -> None:
        if war.status == WarStatus.ended:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=WAR_CLOSED)

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
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=WAR_MAP_SEALED)
