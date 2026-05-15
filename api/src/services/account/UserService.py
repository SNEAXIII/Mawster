import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import select

from src.Messages.user_messages import (
    USER_DOESNT_EXISTS,
    USER_IS_DELETED,
    USER_IS_DISABLED,
    TARGET_USER_IS_ALREADY_DELETED,
    LOGIN_ALREADY_TAKEN,
)
from src.models import User
from src.utils.db import SessionDep


class UserService:
    @classmethod
    async def get_user(cls, session: SessionDep, user_id: uuid.UUID) -> Optional[User]:
        result = await session.get(User, user_id)
        return result

    @classmethod
    async def get_user_by_login(cls, session: SessionDep, login: str) -> Optional[User]:
        sql = select(User).where(User.login == login)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    async def get_user_by_login_with_validity_check(
        cls, session: SessionDep, login: str
    ) -> Optional[User]:
        user = await UserService.get_user_by_login(session, login)
        if user is None:
            raise USER_DOESNT_EXISTS
        if user.deleted_at:
            raise USER_IS_DELETED
        if user.disabled_at:
            raise USER_IS_DISABLED
        return user

    @classmethod
    async def get_user_by_id_with_validity_check(
        cls, session: SessionDep, user_id: str
    ) -> Optional[User]:
        try:
            uid = uuid.UUID(user_id)
        except (ValueError, AttributeError):
            raise USER_DOESNT_EXISTS
        user = await UserService.get_user(session, uid)
        if user is None:
            raise USER_DOESNT_EXISTS
        if user.deleted_at:
            raise USER_IS_DELETED
        if user.disabled_at:
            raise USER_IS_DISABLED
        return user

    @classmethod
    async def update_login(cls, session: SessionDep, user: User, new_login: str) -> User:
        existing = await cls.get_user_by_login(session, new_login)
        if existing is not None and existing.id != user.id:
            raise LOGIN_ALREADY_TAKEN
        user.login = new_login
        await session.commit()
        await session.refresh(user)
        return user

    @classmethod
    async def self_delete(
        cls,
        session: SessionDep,
        current_user: User,
    ) -> True:
        if current_user.deleted_at:
            # If user already deleted, raise the specific 'already deleted' error
            raise TARGET_USER_IS_ALREADY_DELETED
        current_user.deleted_at = datetime.now()
        await session.commit()
        return True
