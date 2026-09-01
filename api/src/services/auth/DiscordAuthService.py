import httpx
from fastapi import HTTPException
from starlette import status

from src.Messages.discord_auth_messages import DISCORD_API_ERROR, DISCORD_TOKEN_INVALID
from src.models import User
from src.services.auth.OAuthService import OAuthService
from src.utils.db import SessionDep

DISCORD_API_URL = "https://discord.com/api/v10"

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
        except httpx.RequestError as exc:
            raise DISCORD_API_ERROR_EXCEPTION from exc

        if response.status_code == 401:
            raise DISCORD_TOKEN_INVALID_EXCEPTION
        if response.status_code != 200:
            raise DISCORD_API_ERROR_EXCEPTION

        return response.json()

    @classmethod
    async def get_or_create_user(cls, session: SessionDep, profile: dict) -> User:
        """Log in, create, or link the account matching this verified Discord profile."""
        return await cls.resolve_user(
            session,
            provider_field="discord_id",
            provider_id=str(profile["id"]),
            email=profile.get("email"),
            email_verified=bool(profile.get("verified")),
        )
