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
    id: uuid.UUID
    user_id: uuid.UUID
    alliance_id: Optional[uuid.UUID] = None
    game_pseudo: str
    is_primary: bool
    created_at: datetime


# ---- Alliance DTOs ----

class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. URL will be added later (TODO)."""
    name: str = Field(..., max_length=100, examples=["My Alliance"])
    tag: str = Field(..., max_length=10, examples=["ALLY"])


class AllianceResponse(BaseModel):
    id: uuid.UUID
    name: str
    tag: str
    created_at: datetime


# ---- Champion User DTOs ----

class ChampionUserCreateRequest(BaseModel):
    """DTO to add a champion to a game account roster."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    champion_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440001"])
    stars: int = Field(default=0, ge=0, le=7, examples=[5])
    rank: int = Field(default=1, ge=1, le=6, examples=[5])
    level: int = Field(default=1, ge=1, examples=[65])
    signature: int = Field(default=0, ge=0, examples=[200])


class ChampionUserResponse(BaseModel):
    id: uuid.UUID
    game_account_id: uuid.UUID
    champion_id: uuid.UUID
    stars: int
    rank: int
    level: int
    signature: int
