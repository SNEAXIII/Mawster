import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_fight_record import AllianceSnapshotStatResponse, ForceSnapshotResponse
from src.dto.dto_utilisateurs import UserAdminViewAllUsers
from src.enums.Roles import Roles
from src.Messages.user_messages import (
    TARGET_USER_DELETED_SUCCESSFULLY,
    TARGET_USER_DEMOTED_SUCCESSFULLY,
    TARGET_USER_DISABLED_SUCCESSFULLY,
    TARGET_USER_ENABLED_SUCCESSFULLY,
    TARGET_USER_PROMOTED_SUCCESSFULLY,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.FightRecordService import FightRecordService
from src.services.UserService import UserService
from src.utils.db import SessionDep

admin_controller = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[
        Depends(AuthService.is_logged_as_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@admin_controller.get("/users", status_code=200, response_model=UserAdminViewAllUsers)
async def get_users(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1)] = 10,
    status: Optional[str] = None,
    role: Optional[Roles] = None,
    search: Optional[str] = None,
):
    result = await UserService.get_users_with_pagination_role_search(
        session, page, size, status, role, search
    )
    return result


@admin_controller.patch("/users/disable/{user_uuid_to_disable}", status_code=200)
async def patch_disable_user(
    session: SessionDep,
    user_uuid_to_disable: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    await UserService.admin_patch_disable_user(session, user_uuid_to_disable)
    return {"message": TARGET_USER_DISABLED_SUCCESSFULLY}


@admin_controller.patch("/users/enable/{user_uuid_to_enable}", status_code=200)
async def patch_enable_user(
    session: SessionDep,
    user_uuid_to_enable: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    await UserService.admin_patch_enable_user(session, user_uuid_to_enable)
    return {"message": TARGET_USER_ENABLED_SUCCESSFULLY}


@admin_controller.delete("/users/delete/{user_uuid_to_delete}", status_code=200)
async def delete_user(
    session: SessionDep,
    user_uuid_to_delete: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    await UserService.admin_delete_user(session, user_uuid_to_delete)
    return {"message": TARGET_USER_DELETED_SUCCESSFULLY}


@admin_controller.patch(
    "/users/promote/{user_uuid_to_promote}",
    status_code=200,
    dependencies=[Depends(AuthService.is_logged_as_super_admin)],
)
async def patch_promote_user(
    session: SessionDep,
    user_uuid_to_promote: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    await UserService.admin_patch_promote_user(session, user_uuid_to_promote)
    return {"message": TARGET_USER_PROMOTED_SUCCESSFULLY}


@admin_controller.patch(
    "/users/demote/{user_uuid_to_demote}",
    status_code=200,
    dependencies=[Depends(AuthService.is_logged_as_super_admin)],
)
async def patch_demote_user(
    session: SessionDep,
    user_uuid_to_demote: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    await UserService.admin_patch_demote_user(session, user_uuid_to_demote)
    return {"message": TARGET_USER_DEMOTED_SUCCESSFULLY}


@admin_controller.post(
    "/wars/force-snapshot", status_code=200, response_model=ForceSnapshotResponse
)
async def force_snapshot_wars(session: SessionDep):
    result = await FightRecordService.force_snapshot_all(session)
    return result


@admin_controller.get(
    "/wars/snapshot-stats", status_code=200, response_model=list[AllianceSnapshotStatResponse]
)
async def get_snapshot_stats(session: SessionDep):
    result = await FightRecordService.get_snapshot_stats(session)
    return result
