import httpx
from fastapi import HTTPException
from starlette import status

from src.Messages.google_auth_messages import (
    GOOGLE_API_ERROR,
    GOOGLE_TOKEN_INVALID,
)
from src.models import User
from src.services.auth.OAuthService import OAuthService
from src.utils.db import SessionDep

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

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
        except httpx.RequestError as exc:
            raise GOOGLE_API_ERROR_EXCEPTION from exc

        if response.status_code == 401:
            raise GOOGLE_TOKEN_INVALID_EXCEPTION
        if response.status_code != 200:
            raise GOOGLE_API_ERROR_EXCEPTION

        return response.json()

    @classmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User:
        """Log in, create, or link the account matching this verified Google profile."""
        return await cls.resolve_user(
            session,
            provider_field="google_id",
            provider_id=str(profile["sub"]),
            email=profile.get("email"),
            email_verified=bool(profile.get("email_verified")),
        )
