import uuid
from typing import Optional
from pydantic import BaseModel, Field


class ChampionUserCreateRequest(BaseModel):
    """DTO to add a champion to a game account roster."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    champion_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440001"])
    rarity: str = Field(..., examples=["6r4"])
    signature: int = Field(default=0, ge=0, examples=[200])


class ChampionUserBulkEntry(BaseModel):
    """Single entry in a bulk roster update request."""
    champion_name: str = Field(..., examples=["Spider-Man"])
    rarity: str = Field(..., examples=["6r4"])
    signature: int = Field(default=0, ge=0, examples=[200])


class ChampionUserBulkRequest(BaseModel):
    """DTO to add multiple champions to a game account roster at once."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    champions: list[ChampionUserBulkEntry] = Field(..., min_length=1)


class ChampionUserResponse(BaseModel):
    id: uuid.UUID
    game_account_id: uuid.UUID
    champion_id: uuid.UUID
    rarity: str
    signature: int

    @classmethod
    def from_model(cls, m) -> "ChampionUserResponse":
        return cls(
            id=m.id,
            game_account_id=m.game_account_id,
            champion_id=m.champion_id,
            rarity=m.rarity,
            signature=m.signature,
        )


class ChampionUserDetailResponse(BaseModel):
    """Roster entry with champion details for display."""
    id: uuid.UUID
    game_account_id: uuid.UUID
    champion_id: uuid.UUID
    rarity: str
    signature: int
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
