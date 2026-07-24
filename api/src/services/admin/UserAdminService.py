import uuid

from sqlalchemy import func
from sqlmodel import select

from src.dto.auth.dto_utilisateurs import UserAdminViewAllUsers, UserAdminViewSingleUser
from src.enums.Roles import Roles
from src.Messages.user_messages import (
    TARGET_USER_DOESNT_EXISTS,
    TARGET_USER_IS_ADMIN,
    TARGET_USER_IS_ALREADY_ADMIN,
    TARGET_USER_IS_ALREADY_DELETED,
    TARGET_USER_IS_ALREADY_DISABLED,
    TARGET_USER_IS_ALREADY_ENABLED,
    TARGET_USER_IS_DELETED,
    TARGET_USER_IS_NOT_ADMIN,
    TARGET_USER_IS_SUPER_ADMIN,
)
from src.models import User
from src.models.Base import utcnow
from src.services.account.UserService import UserService
from src.utils.db import SessionDep

DISABLED_STATUS = "disabled"
DELETED_STATUS = "deleted"
ENABLED_STATUS = "enabled"


class UserAdminService:
    @classmethod
    def _validate_target_user_for_action(
        cls,
        user: User | None,
        require_disabled: bool | None = None,
        forbid_admin: bool = True,
    ) -> None:
        if user is None:
            raise TARGET_USER_DOESNT_EXISTS
        if user.deleted_at:
            raise TARGET_USER_IS_DELETED
        if user.role == Roles.SUPER_ADMIN:
            raise TARGET_USER_IS_SUPER_ADMIN
        if forbid_admin and user.role == Roles.ADMIN:
            raise TARGET_USER_IS_ADMIN
        if require_disabled is True and not user.disabled_at:
            raise TARGET_USER_IS_ALREADY_ENABLED
        if require_disabled is False and user.disabled_at:
            raise TARGET_USER_IS_ALREADY_DISABLED

    @classmethod
    async def admin_patch_disable_user(cls, session: SessionDep, user_uuid: uuid.UUID) -> True:
        user: User | None = await UserService.get_user(session, user_uuid)
        cls._validate_target_user_for_action(user, require_disabled=False, forbid_admin=True)
        user.disabled_at = utcnow()
        await session.commit()
        return True

    @classmethod
    async def admin_patch_enable_user(cls, session: SessionDep, user_uuid: uuid.UUID) -> True:
        user: User | None = await UserService.get_user(session, user_uuid)
        cls._validate_target_user_for_action(user, require_disabled=True, forbid_admin=False)
        user.disabled_at = None
        await session.commit()
        return True

    @classmethod
    async def admin_delete_user(cls, session: SessionDep, user_uuid: uuid.UUID) -> True:
        user: User | None = await UserService.get_user(session, user_uuid)
        if user is None:
            raise TARGET_USER_DOESNT_EXISTS
        if user.deleted_at:
            raise TARGET_USER_IS_ALREADY_DELETED
        cls._validate_target_user_for_action(user, require_disabled=None, forbid_admin=True)
        user.deleted_at = utcnow()
        await session.commit()
        return True

    @classmethod
    async def admin_patch_promote_user(cls, session: SessionDep, user_uuid: uuid.UUID) -> True:
        user: User | None = await UserService.get_user(session, user_uuid)
        cls._validate_target_user_for_action(user, require_disabled=None, forbid_admin=True)
        if user.role == Roles.ADMIN:
            raise TARGET_USER_IS_ALREADY_ADMIN
        user.role = Roles.ADMIN
        user.disabled_at = None
        await session.commit()
        return True

    @classmethod
    async def admin_patch_demote_user(cls, session: SessionDep, user_uuid: uuid.UUID) -> True:
        user: User | None = await UserService.get_user(session, user_uuid)
        if user is None:
            raise TARGET_USER_DOESNT_EXISTS
        if user.deleted_at:
            raise TARGET_USER_IS_DELETED
        if user.role == Roles.SUPER_ADMIN:
            raise TARGET_USER_IS_SUPER_ADMIN
        if user.role != Roles.ADMIN:
            raise TARGET_USER_IS_NOT_ADMIN
        user.role = Roles.USER
        await session.commit()
        return True

    @classmethod
    def build_status_filter(cls, sql, status: str | None):
        if status == DELETED_STATUS:
            sql = sql.where(User.deleted_at.is_not(None))
        elif status == DISABLED_STATUS:
            sql = sql.where(User.deleted_at.is_(None)).where(User.disabled_at.is_not(None))
        elif status == ENABLED_STATUS:
            sql = sql.where(User.deleted_at.is_(None)).where(User.disabled_at.is_(None))
        return sql

    @classmethod
    def build_role_filter(cls, sql, role: Roles | None = None):
        if role in Roles.__members__.values():
            sql = sql.where(User.role == role)
        return sql

    @classmethod
    def build_search_filter(cls, sql, search: str | None):
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            sql = sql.where(User.login.ilike(pattern))
        return sql

    @classmethod
    async def get_users_paginated(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        status: str | None,
        role: Roles | None = None,
        search: str | None = None,
    ) -> list[User]:
        offset = (page - 1) * size
        sql = select(User)
        if status:
            sql = UserAdminService.build_status_filter(sql, status)
        if role:
            sql = UserAdminService.build_role_filter(sql, role)
        if search:
            sql = UserAdminService.build_search_filter(sql, search)
        sql = sql.offset(offset).limit(size)
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_total_users(
        cls,
        session: SessionDep,
        status: str | None,
        role: Roles | None = None,
        search: str | None = None,
    ) -> int:
        sql = select(func.count(User.id))
        if status:
            sql = UserAdminService.build_status_filter(sql, status)
        if role:
            sql = UserAdminService.build_role_filter(sql, role)
        if search:
            sql = UserAdminService.build_search_filter(sql, search)
        result = await session.exec(sql)
        return result.one()

    @classmethod
    async def get_users_with_pagination_role_search(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        status: str | None = None,
        role: Roles | None = None,
        search: str | None = None,
    ) -> UserAdminViewAllUsers:
        total_users = await UserAdminService.get_total_users(session, status, role, search)
        users = await UserAdminService.get_users_paginated(
            session, page, size, status, role, search
        )
        total_pages = (total_users + size - 1) // size
        mapped_users = [UserAdminViewSingleUser.model_validate(user.model_dump()) for user in users]
        return UserAdminViewAllUsers(
            users=mapped_users,
            total_users=total_users,
            total_pages=total_pages,
            current_page=page,
        )
