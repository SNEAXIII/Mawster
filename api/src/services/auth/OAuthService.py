import random
import string
from abc import ABC, abstractmethod

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.enums.Roles import Roles
from src.Messages.oauth_messages import (
    ACCOUNT_UNAVAILABLE,
    ACCOUNT_UNAVAILABLE_CODE,
    PROVIDER_ALREADY_LINKED,
    PROVIDER_ALREADY_LINKED_CODE,
)
from src.models import LoginLog, User
from src.models.Base import utcnow
from src.security.secrets import SECRET
from src.utils.db import SessionDep
from src.utils.email_hash import hash_email
from src.utils.logging_config import audit_log

_ADJECTIVES = [
    "cosmic",
    "mighty",
    "iron",
    "shadow",
    "storm",
    "silver",
    "golden",
    "dark",
    "thunder",
    "mystic",
]
_NOUNS = [
    "hero",
    "blade",
    "hunter",
    "striker",
    "guardian",
    "avenger",
    "champion",
    "seeker",
    "warrior",
    "knight",
]

PLACEHOLDER_EMAIL_SUFFIX = ".placeholder"

PROVIDER_ALREADY_LINKED_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={"code": PROVIDER_ALREADY_LINKED_CODE, "message": PROVIDER_ALREADY_LINKED},
)

ACCOUNT_UNAVAILABLE_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={"code": ACCOUNT_UNAVAILABLE_CODE, "message": ACCOUNT_UNAVAILABLE},
)


class OAuthService(ABC):
    @classmethod
    @abstractmethod
    async def verify_token(cls, access_token: str) -> dict: ...

    @classmethod
    @abstractmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User: ...

    @classmethod
    def _random_base_login(cls) -> str:
        adj = random.choice(_ADJECTIVES)
        noun = random.choice(_NOUNS)
        digits = "".join(random.choices(string.digits, k=2))
        return f"{adj}{noun}{digits}"

    @classmethod
    def _normalize_login(cls, username: str) -> str:
        normalized = "".join(c for c in username if c.isalnum())
        if len(normalized) < 4:
            suffix = "".join(random.choices(string.digits, k=4))
            normalized = f"{normalized}{suffix}"
        return normalized[:15]

    @classmethod
    async def _generate_unique_login(cls, session: SessionDep, username: str) -> str:
        base_login = cls._normalize_login(username)
        login = base_login
        for _ in range(10):
            sql = select(User).where(User.login == login)
            result = await session.exec(sql)
            if result.first() is None:
                return login
            suffix = "".join(random.choices(string.digits, k=3))
            login = f"{base_login[:12]}{suffix}"
        return f"user{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"

    @classmethod
    async def resolve_user(
        cls,
        session: SessionDep,
        *,
        provider_field: str,
        provider_id: str,
        email: str | None,
        email_verified: bool,
    ) -> User:
        """Log in, create, or link an account for a verified OAuth profile.

        Only verified addresses are hashed into `email_hash`: an unverified one
        would let an attacker register a victim's address and capture the
        victim's account when they later sign in with their real provider.
        """
        existing = await cls._get_user_by_provider_id(session, provider_field, provider_id)
        if existing is not None:
            return await cls._login_existing(session, existing, email, email_verified)

        if not cls._is_linkable_email(email, email_verified):
            return await cls._create_user(session, provider_field, provider_id, email_hash=None)

        email_hash = hash_email(email)
        match = await cls._get_user_by_email_hash(session, email_hash)
        if match is None:
            return await cls._create_user(
                session, provider_field, provider_id, email_hash=email_hash
            )

        return await cls._link_provider(session, match, provider_field, provider_id)

    @staticmethod
    def _is_linkable_email(email: str | None, email_verified: bool) -> bool:
        return bool(email) and email_verified and not email.endswith(PLACEHOLDER_EMAIL_SUFFIX)

    @staticmethod
    async def _get_user_by_provider_id(
        session: SessionDep, provider_field: str, provider_id: str
    ) -> User | None:
        result = await session.exec(
            select(User).where(getattr(User, provider_field) == provider_id)
        )
        return result.first()

    @staticmethod
    async def _get_user_by_email_hash(session: SessionDep, email_hash: str) -> User | None:
        result = await session.exec(select(User).where(User.email_hash == email_hash))
        return result.first()

    @classmethod
    async def _login_existing(
        cls, session: SessionDep, user: User, email: str | None, email_verified: bool
    ) -> User:
        user.set_last_login_date(utcnow())
        # Two guards, both load-bearing: only refresh a hash that already exists
        # (writing a new one here would index an address that never went through
        # the linkable check), and only from an address the provider still
        # reports as verified (a provider that flips to unverified must not get
        # its address indexed just because the pepper version happens to be stale).
        if (
            email
            and email_verified
            and user.email_hash
            and user.email_hash_version != SECRET.EMAIL_PEPPER_VERSION
        ):
            user.email_hash = hash_email(email)
            user.email_hash_version = SECRET.EMAIL_PEPPER_VERSION
        session.add(LoginLog(user=user))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    @classmethod
    async def _create_user(
        cls,
        session: SessionDep,
        provider_field: str,
        provider_id: str,
        *,
        email_hash: str | None,
    ) -> User:
        login = await cls._generate_unique_login(session, cls._random_base_login())
        user = User(login=login, email_hash=email_hash, role=Roles.USER)
        setattr(user, provider_field, provider_id)
        user.set_last_login_date(utcnow())
        session.add(user)
        session.add(LoginLog(user=user))
        await session.commit()
        await session.refresh(user)
        return user

    @classmethod
    async def _link_provider(
        cls, session: SessionDep, user: User, provider_field: str, provider_id: str
    ) -> User:
        if user.deleted_at is not None or user.disabled_at is not None:
            raise ACCOUNT_UNAVAILABLE_EXCEPTION
        if getattr(user, provider_field) is not None:
            raise PROVIDER_ALREADY_LINKED_EXCEPTION

        setattr(user, provider_field, provider_id)
        user.set_last_login_date(utcnow())
        session.add(LoginLog(user=user))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        audit_log("auth.link", user_id=str(user.id), detail=f"provider={provider_field}")
        return user
