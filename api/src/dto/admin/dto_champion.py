import uuid

from pydantic import BaseModel, ConfigDict, Field


class ChampionResponse(BaseModel):
    """DTO representing a champion in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    champion_class: str
    image_url: str | None = None
    is_7_star: bool = False
    is_ascendable: bool = False
    has_prefight: bool = False
    alias: str | None = None


class ChampionPaginatedResponse(BaseModel):
    """Paginated list of champions."""

    champions: list[ChampionResponse]
    total_champions: int
    total_pages: int
    current_page: int


class ChampionUpdateAliasRequest(BaseModel):
    """DTO to update alias of a champion."""

    alias: str | None = Field(default=None, max_length=500, examples=["spidey;peter;spider"])


class ChampionLoadRequest(BaseModel):
    """Single champion entry for bulk load."""

    name: str = Field(..., max_length=100)
    champion_class: str = Field(..., max_length=20)
    image_url: str | None = Field(default=None, max_length=500)
    is_ascendable: bool | None = None
    has_prefight: bool | None = None
    alias: str | None = Field(default=None, max_length=500)
