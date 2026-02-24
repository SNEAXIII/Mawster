import uuid
from datetime import datetime
from typing import Optional

from src.enums.Roles import Roles
from src.models import User
from tests.utils.utils_db import load_objects


from tests.utils.utils_constant import (
    DISCORD_ID,
    USER_LOGIN,
    USER_EMAIL,
    ADMIN_LOGIN,
    ADMIN_EMAIL,
    USER_ID,
)


def get_generic_user(
    is_base_id: bool = False,
    login: Optional[str] = None,
    email: Optional[str] = None,
    role: Optional[Roles] = None,
    disabled_at: Optional[datetime] = None,
    deleted_at: Optional[datetime] = None,
) -> User:
    return User(
        id=USER_ID if is_base_id else uuid.uuid4(),
        login=login or USER_LOGIN,
        email=email or USER_EMAIL,
        discord_id=DISCORD_ID,
        role=role or Roles.USER,
        disabled_at=disabled_at,
        deleted_at=deleted_at,
    )


def get_user(
    disabled_at: Optional[datetime] = None,
    deleted_at: Optional[datetime] = None,
) -> User:
    return get_generic_user(
        is_base_id=True, disabled_at=disabled_at, deleted_at=deleted_at
    )


def get_admin(
    disabled_at: Optional[datetime] = None,
    deleted_at: Optional[datetime] = None,
) -> User:
    return get_generic_user(
        is_base_id=True,
        login=ADMIN_LOGIN,
        email=ADMIN_EMAIL,
        role=Roles.ADMIN,
        disabled_at=disabled_at,
        deleted_at=deleted_at,
    )


async def do_nothing():
    return


async def push_one_user():
    await load_objects([get_user()])


async def push_user2():
    """Insert the second standard test user (USER2_*)."""
    from tests.utils.utils_constant import USER2_ID, USER2_LOGIN, USER2_EMAIL, DISCORD_ID_2

    user2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL, role=Roles.USER)
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])


async def push_one_admin():
    await load_objects([get_admin()])
