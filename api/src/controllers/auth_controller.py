from typing import Annotated
import logging

from fastapi import APIRouter, Depends
from src.security import IS_PROD

from src.dto.dto_token import LoginResponse, TokenBody, RefreshTokenRequest
from src.dto.dto_utilisateurs import (
    DiscordLoginRequest,
    UserProfile,
)
from src.models import User
from src.services.JWTService import JWTService
from src.services.AuthService import (
    AuthService,
)
from src.services.DiscordAuthService import DiscordAuthService
from src.services.UserService import UserService

from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

logger = logging.getLogger(__name__)

auth_controller = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


@auth_controller.get("/session", response_model=UserProfile)
async def read_users_me(
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    return current_user


@auth_controller.post("/session", response_model=UserProfile)
async def read_users_me_with_token(body: TokenBody, session: SessionDep):
    """Accept a token in the request body, decode it and return the corresponding user profile.

    This endpoint is used by tests which POST a token payload instead of using Authorization header.
    """
    data = JWTService.decode_jwt(body.token)
    user_id = data.get("user_id")
    user = await UserService.get_user_by_id_with_validity_check(session, user_id)
    return user


@auth_controller.post("/discord", response_model=LoginResponse, status_code=200)
async def discord_login(discord_data: DiscordLoginRequest, session: SessionDep) -> LoginResponse:
    """Authentification via Discord OAuth2.

    Appele par le serveur NextAuth apres un flow OAuth Discord reussi.
    Verifie le token d'acces Discord aupres de l'API Discord avant de
    creer/retrouver l'utilisateur. Aucune donnee profil n'est acceptee
    directement du client.

    Returns:
        LoginResponse: JWT backend signe pour les appels API subsequents
    """
    # Verification du token aupres de Discord
    discord_profile = await DiscordAuthService.verify_discord_token(discord_data.access_token)

    user = await DiscordAuthService.get_or_create_discord_user(session, discord_profile)
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)

    audit_log("auth.login", user_id=str(user.id), detail="method=discord")

    if not IS_PROD:
        logger.warning("=" * 80)
        logger.warning("⚠️  DEBUG JWT — À RETIRER AVANT PRODUCTION ⚠️")
        logger.warning("User: %s (discord_id: %s)", user.login, user.discord_id)
        logger.warning("JWT: %s", access_token)
        logger.warning("=" * 80)

    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@auth_controller.post("/refresh", response_model=LoginResponse, status_code=200)
async def refresh_access_token(body: RefreshTokenRequest, session: SessionDep) -> LoginResponse:
    """Use a refresh token to obtain a new access token + refresh token pair."""
    data = JWTService.decode_refresh_token(body.refresh_token)
    user_id = data.get("user_id")
    user = await UserService.get_user_by_id_with_validity_check(session, user_id)

    new_access_token = JWTService.create_access_token(user)
    new_refresh_token = JWTService.create_refresh_token(user)

    audit_log("auth.refresh", user_id=str(user.id), detail="method=refresh_token")

    return LoginResponse(
        token_type="bearer",
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )
