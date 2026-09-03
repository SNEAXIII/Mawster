import httpx
from fastapi import HTTPException
from starlette import status

from src.Messages.google_auth_messages import (
    GOOGLE_API_ERROR,
    GOOGLE_TOKEN_FOREIGN_APP,
    GOOGLE_TOKEN_INVALID,
)
from src.models import User
from src.security.secrets import SECRET
from src.services.auth.OAuthService import OAuthService
from src.utils.db import SessionDep

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

GOOGLE_TOKEN_INVALID_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=GOOGLE_TOKEN_INVALID,
)

GOOGLE_API_ERROR_EXCEPTION = HTTPException(
    status_code=status.HTTP_502_BAD_GATEWAY,
    detail=GOOGLE_API_ERROR,
)

GOOGLE_TOKEN_FOREIGN_APP_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=GOOGLE_TOKEN_FOREIGN_APP,
)


class GoogleAuthService(OAuthService):
    @classmethod
    async def verify_token(cls, access_token: str) -> dict:
        """Vérifie que le token appartient à Mawster, puis lit le profil Google.

        `tokeninfo` renvoie l'audience (`aud`) du token, c'est-à-dire le client
        auquel il a été délivré. `userinfo` seul se contente de dire que le token
        est valide quelque part, ce qui laisserait passer le token d'une autre
        application et l'identité de sa victime avec lui.

        Returns:
            dict avec sub, email, name, picture

        Raises:
            HTTPException 401: Token invalide, expiré, ou émis pour une autre app
            HTTPException 502: Erreur de communication avec Google
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                token_info = await client.get(
                    GOOGLE_TOKENINFO_URL, params={"access_token": access_token}
                )
            except httpx.RequestError as exc:
                raise GOOGLE_API_ERROR_EXCEPTION from exc

            # tokeninfo répond 400 sur un token inconnu ou expiré, pas 401.
            if token_info.status_code in (400, 401):
                raise GOOGLE_TOKEN_INVALID_EXCEPTION
            if token_info.status_code != 200:
                raise GOOGLE_API_ERROR_EXCEPTION

            if token_info.json().get("aud") != SECRET.GOOGLE_CLIENT_ID:
                raise GOOGLE_TOKEN_FOREIGN_APP_EXCEPTION

            try:
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
