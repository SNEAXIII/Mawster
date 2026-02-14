from typing import Annotated

from fastapi import APIRouter, Depends

from src.dto.dto_token import LoginResponse
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

from src.utils.db import SessionDep

auth_controller = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


@auth_controller.get("/session", response_model=UserProfile)
async def read_users_me(
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    return current_user


@auth_controller.post("/discord", response_model=LoginResponse, status_code=200)
async def discord_login(discord_data: DiscordLoginRequest, session: SessionDep) -> LoginResponse:
    """Authentification via Discord OAuth2.

    Appelé par le serveur NextAuth après un flow OAuth Discord réussi.
    Crée automatiquement le compte utilisateur si c'est un premier login.

    Returns:
        LoginResponse: JWT backend signé pour les appels API subséquents
    """
    user = await DiscordAuthService.get_or_create_discord_user(session, discord_data)
    access_token = JWTService.create_access_token(user)
    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
    )
