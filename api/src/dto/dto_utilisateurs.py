import uuid
from typing import Optional


from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

from src.enums.Roles import Roles

EXAMPLE_EMAIL = "user@gmail.com"


class UserBaseResponse(BaseModel):
    login: str = Field(examples=["User"])
    email: EmailStr = Field(examples=[EXAMPLE_EMAIL])
    role: Roles = Field(examples=[Roles.USER.value])


class UserProfile(UserBaseResponse):
    last_login_date: Optional[datetime] = Field(default=None)
    created_at: datetime = Field()
    discord_id: str = Field()
    avatar_url: Optional[str] = Field(default=None)


class UserAdminViewSingleUser(UserBaseResponse):
    id: uuid.UUID
    created_at: datetime
    last_login_date: Optional[datetime] = Field(default=None)
    disabled_at: Optional[datetime]
    deleted_at: Optional[datetime]


class UserAdminViewAllUsers(BaseModel):
    users: list[UserAdminViewSingleUser]
    total_users: int = Field(default=1)
    total_pages: int = Field(default=1)
    current_page: int = Field(default=1)


class DiscordLoginRequest(BaseModel):
    """DTO pour la connexion via Discord OAuth2.
    Le frontend envoie le token d'acces Discord ; le backend le verifie
    directement aupres de l'API Discord pour garantir l'authenticite."""
    access_token: str = Field(..., examples=["ya29.a0AfH6SM..."])
