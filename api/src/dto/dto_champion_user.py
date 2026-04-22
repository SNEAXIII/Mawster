import uuid
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChampionUserCreateRequest(BaseModel):
    """DTO to add a champion to a game account roster."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    champion_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440001"])
    rarity: str = Field(..., examples=["6r4"])
    signature: int = Field(default=0, ge=0, examples=[200])
    is_preferred_attacker: bool = Field(default=False)
    ascension: int = Field(default=0, ge=0, le=2, examples=[0])


class ChampionUserBulkEntry(BaseModel):
    """Single entry in a bulk roster update request."""

    champion_name: str = Field(..., examples=["Spider-Man"])
    rarity: str = Field(..., examples=["6r4"])
    signature: int = Field(default=0, ge=0, examples=[200])
    is_preferred_attacker: bool = Field(default=False)
    ascension: int = Field(default=0, ge=0, le=2, examples=[0])


class ChampionUserBulkRequest(BaseModel):
    """DTO to add multiple champions to a game account roster at once."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    champions: list[ChampionUserBulkEntry] = Field(..., min_length=1)


class ChampionUserResponse(BaseModel):
    """DTO for a champion-user roster entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_account_id: uuid.UUID
    champion_id: uuid.UUID
    rarity: str
    signature: int
    is_preferred_attacker: bool = False
    ascension: int = 0


class ChampionUserDetailResponse(ChampionUserResponse):
    """Roster entry with champion details for display.
    Extends ChampionUserResponse with champion-level fields."""

    is_ascendable: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def flatten_champion(cls, data: Any) -> Any:
        """Flatten the nested `.champion` relationship into top-level fields."""
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "game_account_id": data.game_account_id,
            "champion_id": data.champion_id,
            "rarity": data.rarity,
            "signature": data.signature,
            "is_preferred_attacker": data.is_preferred_attacker,
            "ascension": data.ascension,
            "is_ascendable": data.champion.is_ascendable,
            "is_saga_attacker": data.champion.is_saga_attacker,
            "is_saga_defender": data.champion.is_saga_defender,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
        }
