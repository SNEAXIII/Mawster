from fastapi import APIRouter, Depends

from src.dto.dto_fight_record import AllianceSnapshotStatResponse, ForceSnapshotResponse
from src.services.auth.AuthService import AuthService
from src.services.admin.FightRecordAdminService import FightRecordAdminService
from src.utils.db import SessionDep

war_admin_controller = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[
        Depends(AuthService.require_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@war_admin_controller.post(
    "/wars/force-snapshot", status_code=200, response_model=ForceSnapshotResponse
)
async def force_snapshot_wars(session: SessionDep):
    result = await FightRecordAdminService.force_snapshot_all(session)
    return result


@war_admin_controller.get(
    "/wars/snapshot-stats", status_code=200, response_model=list[AllianceSnapshotStatResponse]
)
async def get_snapshot_stats(session: SessionDep):
    result = await FightRecordAdminService.get_snapshot_stats(session)
    return result
