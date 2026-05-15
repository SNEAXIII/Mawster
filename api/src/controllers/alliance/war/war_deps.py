import uuid
from typing import Annotated

from fastapi import Depends

from src.models.War import War
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep


async def _get_war(
    war_id: uuid.UUID,
    alliance_id: uuid.UUID,
    session: SessionDep,
) -> War:
    return await WarService.get_war(session, war_id, alliance_id)


WarDep = Annotated[War, Depends(_get_war)]
