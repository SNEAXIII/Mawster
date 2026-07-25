import uuid
from datetime import datetime

from src.enums.Roles import Roles
from src.models import User
from src.utils.email_hash import hash_email
from tests.utils.utils_constant import (
    ADMIN_EMAIL,
    ADMIN_LOGIN,
    DISCORD_ID,
    USER_EMAIL,
    USER_ID,
    USER_LOGIN,
)
from tests.utils.utils_db import load_objects


def get_generic_user(
    is_base_id: bool = False,
    login: str | None = None,
    email: str | None = None,
    role: Roles | None = None,
    disabled_at: datetime | None = None,
    deleted_at: datetime | None = None,
) -> User:
    raw_email = email or USER_EMAIL
    return User(
        id=USER_ID if is_base_id else uuid.uuid4(),
        login=login or USER_LOGIN,
        email_hash=hash_email(raw_email),
        discord_id=DISCORD_ID,
        role=role or Roles.USER,
        disabled_at=disabled_at,
        deleted_at=deleted_at,
    )


def get_user(
    disabled_at: datetime | None = None,
    deleted_at: datetime | None = None,
) -> User:
    return get_generic_user(is_base_id=True, disabled_at=disabled_at, deleted_at=deleted_at)


def get_admin(
    disabled_at: datetime | None = None,
    deleted_at: datetime | None = None,
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
    from tests.utils.utils_constant import DISCORD_ID_2, USER2_EMAIL, USER2_ID, USER2_LOGIN

    user2 = get_generic_user(
        login=USER2_LOGIN, email=USER2_EMAIL, role=Roles.USER
    )  # email param hashed internally
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])


async def push_one_admin():
    await load_objects([get_admin()])


def get_super_admin(
    disabled_at: datetime | None = None,
    deleted_at: datetime | None = None,
) -> User:
    return get_generic_user(
        is_base_id=True,
        login=ADMIN_LOGIN,
        email=ADMIN_EMAIL,
        role=Roles.SUPER_ADMIN,
        disabled_at=disabled_at,
        deleted_at=deleted_at,
    )


async def push_one_super_admin():
    await load_objects([get_super_admin()])
