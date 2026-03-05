import uuid
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.Champion import Champion as ChampionModel


class ChampionResponse(BaseModel):
    """DTO representing a champion in API responses."""
    id: uuid.UUID
    name: str
    champion_class: str
    image_url: Optional[str] = None
    is_7_star: bool = False
    is_ascendable: bool = False
    alias: Optional[str] = None

    @classmethod
    def from_model(cls, m: "ChampionModel") -> "ChampionResponse":
        return cls(
            id=m.id,
            name=m.name,
            champion_class=m.champion_class,
            image_url=m.image_url,
            is_7_star=m.is_7_star,
            is_ascendable=m.is_ascendable,
            alias=m.alias,
        )


class ChampionPaginatedResponse(BaseModel):
    """Paginated list of champions."""
    champions: list[ChampionResponse]
    total_champions: int
    total_pages: int
    current_page: int


class ChampionUpdateAliasRequest(BaseModel):
    """DTO to update alias of a champion."""
    alias: Optional[str] = Field(default=None, max_length=500, examples=["spidey;peter;spider"])


class ChampionLoadRequest(BaseModel):
    """Single champion entry for bulk load."""
    name: str = Field(..., max_length=100)
    champion_class: str = Field(..., max_length=20)
    image_url: Optional[str] = None
    is_ascendable: bool = False
    alias: Optional[str] = Field(default=None, max_length=500)
