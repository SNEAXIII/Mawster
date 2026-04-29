from datetime import datetime
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.security.secrets import SECRET
from src.enums.Roles import Roles
from src.Messages.discord_auth_messages import (
    DISCORD_API_ERROR,
    DISCORD_TOKEN_INVALID,
    EMAIL_CONFLICT,
)
from src.models import User, LoginLog
from src.services.OAuthService import OAuthService
from src.utils.db import SessionDep
from src.utils.email_hash import hash_email

DISCORD_API_URL = "https://discord.com/api/v10"

EMAIL_CONFLICT_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=EMAIL_CONFLICT,
)

DISCORD_TOKEN_INVALID_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=DISCORD_TOKEN_INVALID,
)

DISCORD_API_ERROR_EXCEPTION = HTTPException(
    status_code=status.HTTP_502_BAD_GATEWAY,
    detail=DISCORD_API_ERROR,
)


class DiscordAuthService(OAuthService):
    @classmethod
    async def verify_token(cls, access_token: str) -> dict:
        """Vérifie le token Discord en appelant l'API Discord /users/@me.

        Returns:
            dict avec id, username, email

        Raises:
            HTTPException 401: Token invalide ou expiré
            HTTPException 502: Erreur de communication avec Discord
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{DISCORD_API_URL}/users/@me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.RequestError:
            raise DISCORD_API_ERROR_EXCEPTION

        if response.status_code == 401:
            raise DISCORD_TOKEN_INVALID_EXCEPTION
        if response.status_code != 200:
            raise DISCORD_API_ERROR_EXCEPTION

        return response.json()

    @classmethod
    async def _get_user_by_discord_id(cls, session: SessionDep, discord_id: str) -> Optional[User]:
        sql = select(User).where(User.discord_id == discord_id)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User:
        """Trouve ou crée un utilisateur à partir du profil Discord vérifié.

        Flow:
        1. Cherche par discord_id → si trouvé, retourne l'utilisateur existant
        2. Vérifie que l'email n'est pas déjà utilisé
        3. Si email libre → crée un nouveau compte Discord
        4. Si email pris → 409 Conflict
        """
        discord_id = str(profile["id"])
        email = profile.get("email") or f"{discord_id}@discord.placeholder"
        username = profile.get("username") or profile.get("global_name") or f"discord_{discord_id}"
        # 1. Recherche par discord_id
        existing_user = await cls._get_user_by_discord_id(session, discord_id)
        if existing_user:
            existing_user.set_last_login_date(datetime.now())
            if existing_user.email_hash_version != SECRET.EMAIL_PEPPER_VERSION:
                existing_user.email_hash = hash_email(email)
                existing_user.email_hash_version = SECRET.EMAIL_PEPPER_VERSION
            login_log = LoginLog(user=existing_user)
            session.add(login_log)
            await session.commit()
            await session.refresh(existing_user)
            return existing_user

        # 2. Vérifier conflit email
        email_hash = hash_email(email)
        sql = select(User).where(User.email_hash == email_hash)
        result = await session.exec(sql)
        if result.first():
            raise EMAIL_CONFLICT_EXCEPTION

        # 3. Créer un nouveau compte Discord
        unique_login = await cls._generate_unique_login(session, username)

        new_user = User(
            login=unique_login,
            email_hash=email_hash,
            discord_id=discord_id,
            role=Roles.USER,
        )
        new_user.set_last_login_date(datetime.now())
        login_log = LoginLog(user=new_user)
        session.add(new_user)
        session.add(login_log)
        await session.commit()
        await session.refresh(new_user)
        return new_user
