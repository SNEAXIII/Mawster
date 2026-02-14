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
    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
    )
