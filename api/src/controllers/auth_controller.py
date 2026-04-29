from typing import Annotated
import logging

from fastapi import APIRouter, Depends, Request

from src.dto.dto_token import LoginResponse, RefreshTokenRequest
from src.dto.dto_utilisateurs import (
    DiscordLoginRequest,
    GoogleLoginRequest,
    UserProfile,
)
from src.models import User
from src.services.JWTService import JWTService
from src.services.AuthService import (
    AuthService,
)
from src.services.DiscordAuthService import DiscordAuthService
from src.services.GoogleAuthService import GoogleAuthService
from src.services.UserService import UserService

from src.utils.db import SessionDep
from src.utils.logging_config import audit_log
from src.utils.rate_limiter import limiter

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


@auth_controller.post("/discord", status_code=200)
@limiter.limit("5/minute")
async def discord_login(
    request: Request, discord_data: DiscordLoginRequest, session: SessionDep
) -> LoginResponse:
    """Authentification via Discord OAuth2.

    Appele par le serveur NextAuth apres un flow OAuth Discord reussi.
    Verifie le token d'acces Discord aupres de l'API Discord avant de
    creer/retrouver l'utilisateur. Aucune donnee profil n'est acceptee
    directement du client.

    Returns:
        LoginResponse: JWT backend signe pour les appels API subsequents
    """
    discord_profile = await DiscordAuthService.verify_token(discord_data.access_token)
    user = await DiscordAuthService.get_or_create_user(session, discord_profile)
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)
    audit_log("auth.login", user_id=str(user.id), detail="method=discord")
    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@auth_controller.post("/google", status_code=200)
@limiter.limit("5/minute")
async def google_login(
    request: Request, google_data: GoogleLoginRequest, session: SessionDep
) -> LoginResponse:
    """Authentification via Google OAuth2.

    Appele par le serveur NextAuth apres un flow OAuth Google reussi.
    Verifie le token d'acces Google aupres de l'API Google avant de
    creer/retrouver l'utilisateur.
    """
    google_profile = await GoogleAuthService.verify_token(google_data.access_token)
    user = await GoogleAuthService.get_or_create_user(session, google_profile)
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)
    audit_log("auth.login", user_id=str(user.id), detail="method=google")
    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@auth_controller.post("/refresh", status_code=200)
@limiter.limit("2/minute")
async def refresh_access_token(
    request: Request, body: RefreshTokenRequest, session: SessionDep
) -> LoginResponse:
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
