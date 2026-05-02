import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_fight_record import WarFightRecordResponse
from src.models import User
from src.services.AuthService import AuthService
from src.services.FightRecordService import FightRecordService
from src.utils.db import SessionDep

fight_record_controller = APIRouter(
    prefix="/fight-records",
    tags=["Fight Records"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@fight_record_controller.get("", response_model=list[WarFightRecordResponse])
async def list_fight_records(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    champion_id: Optional[uuid.UUID] = Query(default=None),
    defender_champion_id: Optional[uuid.UUID] = Query(default=None),
    node_number: Optional[int] = Query(default=None, ge=1, le=50),
    tier: Optional[int] = Query(default=None),
    season_id: Optional[uuid.UUID] = Query(default=None),
    alliance_id: Optional[uuid.UUID] = Query(default=None),
    battlegroup: Optional[int] = Query(default=None, ge=1, le=3),
):
    await FightRecordService.assert_user_in_alliance(session, current_user.id)
    records = await FightRecordService.get_fight_records(
        session,
        champion_id=champion_id,
        defender_champion_id=defender_champion_id,
        node_number=node_number,
        tier=tier,
        season_id=season_id,
        alliance_id=alliance_id,
        battlegroup=battlegroup,
    )
    return [WarFightRecordResponse.model_validate(r) for r in records]
