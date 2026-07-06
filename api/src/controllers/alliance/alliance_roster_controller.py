import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from src.dto.alliance.dto_alliance_roster import AllianceRosterEntryResponse
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.AllianceRosterService import AllianceRosterService
from src.services.admin.SagaService import SagaService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

alliance_roster_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@alliance_roster_controller.get(
    "/{alliance_id}/roster", response_model=list[AllianceRosterEntryResponse]
)
async def get_alliance_roster(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get every champion owned across the whole alliance. Members, officers, owner or visitors."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    entries = await AllianceRosterService.get_alliance_roster(session, alliance_id)
    saga = await SagaService.resolve_current(session)
    responses = [AllianceRosterEntryResponse.model_validate(e) for e in entries]
    for dto, e in zip(responses, entries):
        att, dfn = saga.get(e.champion_id, (False, False))
        dto.is_saga_attacker, dto.is_saga_defender = att, dfn
    return responses
