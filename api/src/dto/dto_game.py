import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


# ---- Game Account DTOs ----

class GameAccountCreateRequest(BaseModel):
    """DTO to create a new game account. Only a pseudo is required."""
    game_pseudo: str = Field(..., max_length=50, examples=["MyGamePseudo"])
    is_primary: bool = Field(default=False, examples=[True])


class GameAccountResponse(BaseModel):
    id: int
    user_id: uuid.UUID
    alliance_id: Optional[int] = None
    game_pseudo: str
    is_primary: bool
    created_at: datetime


# ---- Alliance DTOs ----

class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. URL will be added later (TODO)."""
    name: str = Field(..., max_length=100, examples=["My Alliance"])
    tag: str = Field(..., max_length=10, examples=["ALLY"])
    description: Optional[str] = Field(default=None, examples=["A great alliance"])


class AllianceResponse(BaseModel):
    id: int
    name: str
    tag: str
    description: Optional[str] = None
    created_at: datetime


# ---- Champion User DTOs ----

class ChampionUserCreateRequest(BaseModel):
    """DTO to add a champion to a game account roster."""
    game_account_id: int = Field(..., examples=[1])
    champion_id: int = Field(..., examples=[1])
    stars: int = Field(default=0, ge=0, le=7, examples=[5])
    rank: int = Field(default=1, ge=1, le=6, examples=[5])
    level: int = Field(default=1, ge=1, examples=[65])
    signature: int = Field(default=0, ge=0, examples=[200])


class ChampionUserResponse(BaseModel):
    id: int
    game_account_id: int
    champion_id: int
    stars: int
    rank: int
    level: int
    signature: int
