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
    Reçu depuis le serveur NextAuth après le flow OAuth Discord."""
    discord_id: str = Field(..., examples=["123456789012345678"])
    email: EmailStr = Field(..., examples=["user@discord.com"])
    username: str = Field(..., examples=["DiscordUser"])
    avatar_url: Optional[str] = Field(default=None, examples=["https://cdn.discordapp.com/avatars/123/abc.png"])
