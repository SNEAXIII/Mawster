from datetime import datetime

import httpx
from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.security.secrets import SECRET
from src.enums.Roles import Roles
from src.Messages.google_auth_messages import (
    GOOGLE_API_ERROR,
    GOOGLE_TOKEN_INVALID,
    EMAIL_CONFLICT,
)
from src.models import User, LoginLog
from src.services.OAuthService import OAuthService
from src.utils.db import SessionDep
from src.utils.email_hash import hash_email

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

EMAIL_CONFLICT_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=EMAIL_CONFLICT,
)

GOOGLE_TOKEN_INVALID_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=GOOGLE_TOKEN_INVALID,
)

GOOGLE_API_ERROR_EXCEPTION = HTTPException(
    status_code=status.HTTP_502_BAD_GATEWAY,
    detail=GOOGLE_API_ERROR,
)


class GoogleAuthService(OAuthService):
    @classmethod
    async def verify_token(cls, access_token: str) -> dict:
        """Vérifie le token Google en appelant l'API userinfo.

        Returns:
            dict avec sub, email, name, picture

        Raises:
            HTTPException 401: Token invalide ou expiré
            HTTPException 502: Erreur de communication avec Google
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.RequestError:
            raise GOOGLE_API_ERROR_EXCEPTION

        if response.status_code == 401:
            raise GOOGLE_TOKEN_INVALID_EXCEPTION
        if response.status_code != 200:
            raise GOOGLE_API_ERROR_EXCEPTION

        return response.json()

    @classmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User:
        """Trouve ou crée un utilisateur à partir du profil Google vérifié.

        Flow:
        1. Cherche par google_id (sub) → si trouvé, retourne l'utilisateur existant
        2. Vérifie que l'email n'est pas déjà utilisé
        3. Si email libre → crée un nouveau compte Google
        4. Si email pris → 409 Conflict
        """
        google_id = str(profile["sub"])
        email = profile.get("email") or f"{google_id}@google.placeholder"
        username = profile.get("name") or f"google_{google_id}"
        # 1. Recherche par google_id
        sql = select(User).where(User.google_id == google_id)
        result = await session.exec(sql)
        existing_user = result.first()

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

        # 3. Créer un nouveau compte Google
        unique_login = await cls._generate_unique_login(session, username)

        new_user = User(
            login=unique_login,
            email_hash=email_hash,
            google_id=google_id,
            role=Roles.USER,
        )
        new_user.set_last_login_date(datetime.now())
        login_log = LoginLog(user=new_user)
        session.add(new_user)
        session.add(login_log)
        await session.commit()
        await session.refresh(new_user)
        return new_user
