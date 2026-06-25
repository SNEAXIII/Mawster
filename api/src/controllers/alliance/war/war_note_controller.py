import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.dto.alliance.war.dto_war_note import (
    WarFightNoteResponse,
    WarFightNoteUpsertRequest,
)
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.war.WarFightNoteService import WarFightNoteService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from src.controllers.alliance.war.war_deps import WarDep

war_note_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_note_controller.put(
    "/{war_id}/nodes/{battlegroup}/{node_number}/note",
    response_model=WarFightNoteResponse,
)
async def upsert_war_fight_note(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    body: WarFightNoteUpsertRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Create or update the note on a war combat node. Officers/owner only."""
    account = await AllianceService.assert_officer_or_owner_by_id(
        session, alliance_id, current_user.id
    )
    note = await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=battlegroup,
        node_number=node_number,
        body=body,
        editor_account_id=account.id,
        editor_user_id=current_user.id,
    )
    return WarFightNoteResponse(
        id=note.id,
        war_id=note.war_id,
        battlegroup=note.battlegroup,
        node_number=note.node_number,
        content=note.content,
        updated_by_pseudo=account.game_pseudo,
        updated_at=note.updated_at,
    )


@war_note_controller.delete(
    "/{war_id}/nodes/{battlegroup}/{node_number}/note",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_war_fight_note(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Soft-delete the note on a war combat node, keeping its history. Officers/owner only."""
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    await WarFightNoteService.delete_note(
        session,
        war=war,
        battlegroup=battlegroup,
        node_number=node_number,
        editor_user_id=current_user.id,
    )
