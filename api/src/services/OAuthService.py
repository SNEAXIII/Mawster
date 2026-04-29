import random
import string
from abc import ABC, abstractmethod

from sqlmodel import select

from src.models import User
from src.utils.db import SessionDep


class OAuthService(ABC):
    @classmethod
    @abstractmethod
    async def verify_token(cls, access_token: str) -> dict: ...

    @classmethod
    @abstractmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User: ...

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
