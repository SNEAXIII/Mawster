import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.dto.alliance.dto_alliance_roster import AllianceRosterEntryResponse
from src.models import User
from src.services.admin.SagaService import SagaService
from src.services.alliance.AllianceRosterService import AllianceRosterService
from src.services.alliance.AllianceService import AllianceService
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
    name: str | None = None,
    champion_class: str | None = None,
    ranks: Annotated[list[str] | None, Query()] = None,
    ascensions: Annotated[list[int] | None, Query()] = None,
    saga_attacker: bool = False,
    saga_defender: bool = False,
    preferred_attacker: bool = False,
    alliance_group: int | None = None,
    no_group: bool = False,
    distinct_champion_limit: int | None = None,
):
    """Get every champion owned across the whole alliance. Members, officers, owner or visitors.

    All filter params are optional; with none supplied the full roster is returned.
    """
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    saga = await SagaService.resolve_current(session)
    saga_attacker_ids = {cid for cid, (att, _) in saga.items() if att} if saga_attacker else None
    saga_defender_ids = {cid for cid, (_, dfn) in saga.items() if dfn} if saga_defender else None
    entries = await AllianceRosterService.get_alliance_roster(
        session,
        alliance_id,
        name=name,
        champion_class=champion_class,
        ranks=ranks,
        ascensions=ascensions,
        preferred_attacker=preferred_attacker,
        alliance_group=alliance_group,
        no_group=no_group,
        saga_attacker_ids=saga_attacker_ids,
        saga_defender_ids=saga_defender_ids,
        distinct_champion_limit=distinct_champion_limit,
    )
    responses = [AllianceRosterEntryResponse.model_validate(e) for e in entries]
    for dto, e in zip(responses, entries):
        att, dfn = saga.get(e.champion_id, (False, False))
        dto.is_saga_attacker, dto.is_saga_defender = att, dfn
    return responses
