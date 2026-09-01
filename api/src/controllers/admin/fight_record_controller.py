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

sort_literal = Literal[
    "created_at",
    "season_number",
    "ko_count",
    "tier",
    "node_number",
    "battlegroup",
    "champion_name",
    "defender_champion_name",
    "alliance_name",
]


@fight_record_controller.get("", response_model=PaginatedFightRecordsResponse)
async def list_fight_records(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    champion_id: Annotated[uuid.UUID | None, Query()] = None,
    defender_champion_id: Annotated[uuid.UUID | None, Query()] = None,
    node_number: Annotated[int | None, Query(ge=1, le=50)] = None,
    tier: Annotated[int | None, Query()] = None,
    season_selector: Annotated[SeasonSelectorType | None, Query()] = None,
    season_id: Annotated[uuid.UUID | None, Query()] = None,
    alliance_id: Annotated[uuid.UUID | None, Query()] = None,
    battlegroup: Annotated[int | None, Query(ge=1, le=3)] = None,
    game_account_pseudo: Annotated[str | None, Query()] = None,
    planning_error_only: Annotated[bool | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    source: Annotated[FightRecordSource, Query()] = FightRecordSource.All,
    sort_by: Annotated[
        sort_literal,
        Query(),
    ] = "created_at",
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
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
