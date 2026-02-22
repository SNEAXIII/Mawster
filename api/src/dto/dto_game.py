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
    alliance_group: Optional[int] = None
    game_pseudo: str
    is_primary: bool
    created_at: datetime


# ---- Alliance DTOs ----

class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. The owner is the game account that creates it."""
    name: str = Field(..., max_length=100, examples=["My Alliance"])
    tag: str = Field(..., max_length=10, examples=["ALLY"])
    owner_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceMemberResponse(BaseModel):
    """A member of an alliance (game account with group info)."""
    id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int] = None
    is_owner: bool = False
    is_officer: bool = False


class AllianceOfficerResponse(BaseModel):
    id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    assigned_at: datetime


class AllianceResponse(BaseModel):
    id: uuid.UUID
    name: str
    tag: str
    owner_id: uuid.UUID
    owner_pseudo: str
    created_at: datetime
    officers: list[AllianceOfficerResponse] = []
    members: list[AllianceMemberResponse] = []
    member_count: int = 0


class AllianceAddOfficerRequest(BaseModel):
    """DTO to add an adjoint (deputy) to an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceRemoveOfficerRequest(BaseModel):
    """DTO to remove an adjoint from an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceAddMemberRequest(BaseModel):
    """DTO to add a game account as member of the alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceSetGroupRequest(BaseModel):
    """DTO to assign a member to a group (1, 2, 3) or remove from group (null)."""
    group: Optional[int] = Field(None, ge=1, le=3, examples=[1])


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
