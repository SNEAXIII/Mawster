import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status as http_status

from src.dto.alliance.war.dto_fight_record_import import (
    FightRecordImportRequest,
    FightRecordImportResponse,
)
from src.models.User import User
from src.services.auth.AuthService import AuthService
from src.services.knowledge.FightRecordImportService import FightRecordImportService
from src.utils.db import SessionDep

fight_record_import_controller = APIRouter(
    prefix="/alliances/{alliance_id}/fight-records",
    tags=["Fight Records Import"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@fight_record_import_controller.post(
    "/import",
    response_model=FightRecordImportResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def import_fight_records(
    alliance_id: uuid.UUID,
    body: FightRecordImportRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    imported, skipped = await FightRecordImportService.import_records(
        session, alliance_id, current_user.id, body.rows
    )
    return FightRecordImportResponse(imported=imported, skipped=skipped)
