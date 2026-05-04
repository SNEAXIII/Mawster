import uuid
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_fight_record import PaginatedFightRecordsResponse
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


@fight_record_controller.get("", response_model=PaginatedFightRecordsResponse)
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
    game_account_pseudo: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    sort_by: Literal[
        "created_at", "ko_count", "tier", "node_number", "battlegroup",
        "champion_name", "defender_champion_name", "alliance_name"
    ] = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    await FightRecordService.assert_user_in_alliance(session, current_user.id)
    return await FightRecordService.get_fight_records(
        session,
        champion_id=champion_id,
        defender_champion_id=defender_champion_id,
        node_number=node_number,
        tier=tier,
        season_id=season_id,
        alliance_id=alliance_id,
        battlegroup=battlegroup,
        game_account_pseudo=game_account_pseudo,
        page=page,
        size=size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
