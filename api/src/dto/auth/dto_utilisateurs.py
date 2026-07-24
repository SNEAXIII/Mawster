import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from src.enums.Roles import Roles


class UserBaseResponse(BaseModel):
    login: str = Field(examples=["User"])
    role: Roles = Field(examples=[Roles.USER.value])


class UserProfile(UserBaseResponse):
    last_login_date: datetime | None = Field(default=None)
    created_at: datetime = Field()


class UserAdminViewSingleUser(UserBaseResponse):
    id: uuid.UUID
    created_at: datetime
    last_login_date: datetime | None = Field(default=None)
    disabled_at: datetime | None = None
    deleted_at: datetime | None = None


class UserAdminViewAllUsers(BaseModel):
    users: list[UserAdminViewSingleUser]
    total_users: int = Field(default=1)
    total_pages: int = Field(default=1)
    current_page: int = Field(default=1)


class UpdateLoginRequest(BaseModel):
    login: str = Field(
        ..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9]+$", examples=["NewLogin"]
    )


class DiscordLoginRequest(BaseModel):
    """DTO pour la connexion via Discord OAuth2.
    Le frontend envoie le token d'acces Discord ; le backend le verifie
    directement aupres de l'API Discord pour garantir l'authenticite."""

    access_token: str = Field(..., examples=["ya29.a0AfH6SM..."])


class GoogleLoginRequest(BaseModel):
    """DTO pour la connexion via Google OAuth2.
    Le frontend envoie le token d'acces Google ; le backend le verifie
    directement aupres de l'API Google pour garantir l'authenticite."""

    access_token: str = Field(..., examples=["ya29.a0AfH6SM..."])
