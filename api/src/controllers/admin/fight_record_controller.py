import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status

from src.dto.admin.dto_fight_record import PaginatedFightRecordsResponse
from src.enums.FightRecordSource import FightRecordSource
from src.enums.SeasonSelectorType import SeasonSelectorType
from src.models import User
from src.services.auth.AuthService import AuthService
from src.services.knowledge.FightRecordService import FightRecordService
from src.utils.db import SessionDep

fight_record_controller = APIRouter(
    prefix="/fight-records",
    tags=["Fight Records"],
    dependencies=[
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@fight_record_controller.get("", response_model=PaginatedFightRecordsResponse)
async def list_fight_records(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    champion_id: uuid.UUID | None = Query(default=None),
    defender_champion_id: uuid.UUID | None = Query(default=None),
    node_number: int | None = Query(default=None, ge=1, le=50),
    tier: int | None = Query(default=None),
    season_selector: SeasonSelectorType | None = Query(default=None),
    season_id: uuid.UUID | None = Query(default=None),
    alliance_id: uuid.UUID | None = Query(default=None),
    battlegroup: int | None = Query(default=None, ge=1, le=3),
    game_account_pseudo: str | None = Query(default=None),
    planning_error_only: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    source: FightRecordSource = Query(default=FightRecordSource.All),
    sort_by: Literal[
        "created_at",
        "ko_count",
        "tier",
        "node_number",
        "battlegroup",
        "champion_name",
        "defender_champion_name",
        "alliance_name",
    ] = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    accessible_ids = await FightRecordService.get_accessible_alliance_ids(session, current_user.id)
    if not accessible_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must belong to or visit an alliance",
        )
    return await FightRecordService.get_fight_records(
        session,
        accessible_alliance_ids=accessible_ids,
        source=source,
        champion_id=champion_id,
        defender_champion_id=defender_champion_id,
        node_number=node_number,
        tier=tier,
        season_selector=season_selector,
        season_id=season_id,
        alliance_id=alliance_id,
        battlegroup=battlegroup,
        game_account_pseudo=game_account_pseudo,
        planning_error_only=planning_error_only,
        page=page,
        size=size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
