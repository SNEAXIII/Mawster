import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_utilisateurs import UserAdminViewAllUsers
from src.enums.Roles import Roles
from src.Messages.user_messages import (
    TARGET_USER_DELETED_SUCCESSFULLY,
    TARGET_USER_DISABLED_SUCCESSFULLY,
    TARGET_USER_ENABLED_SUCCESSFULLY,
    TARGET_USER_PROMOTED_SUCCESSFULLY,
)
from src.services.AuthService import AuthService
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
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1),
    status: Optional[str] = None,
    role: Optional[Roles] = None,
):
    result = await UserService.get_users_with_pagination(
        session, page, size, status, role
    )
    return result


@admin_controller.patch("/users/disable/{user_uuid_to_disable}", status_code=200)
async def patch_disable_user(session: SessionDep, user_uuid_to_disable: uuid.UUID):
    await UserService.admin_patch_disable_user(session, user_uuid_to_disable)
    return {"message": TARGET_USER_DISABLED_SUCCESSFULLY}


@admin_controller.patch("/users/enable/{user_uuid_to_enable}", status_code=200)
async def patch_enable_user(session: SessionDep, user_uuid_to_enable: uuid.UUID):
    await UserService.admin_patch_enable_user(session, user_uuid_to_enable)
    return {"message": TARGET_USER_ENABLED_SUCCESSFULLY}


@admin_controller.delete("/users/delete/{user_uuid_to_delete}", status_code=200)
async def delete_user(session: SessionDep, user_uuid_to_delete: uuid.UUID):
    await UserService.admin_delete_user(session, user_uuid_to_delete)
    return {"message": TARGET_USER_DELETED_SUCCESSFULLY}


@admin_controller.patch("/users/promote/{user_uuid_to_promote}", status_code=200)
async def patch_promote_user(session: SessionDep, user_uuid_to_promote: uuid.UUID):
    await UserService.admin_patch_promote_user(session, user_uuid_to_promote)
    return {"message": TARGET_USER_PROMOTED_SUCCESSFULLY}



