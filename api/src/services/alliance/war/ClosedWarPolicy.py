from fastapi import HTTPException
from starlette import status

from src.enums.WarStatus import WarStatus
from src.Messages.war_messages import WAR_CLOSED
from src.models.war.War import War


class ClosedWarPolicy:
    """What a closed War still lets through — see docs/adr/0017."""

    @staticmethod
    def assert_open(war: War) -> None:
        if war.status == WarStatus.ended:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=WAR_CLOSED)
