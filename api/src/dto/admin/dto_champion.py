import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ChampionOrderBy = Literal["name", "champion_class"]
ChampionOrderDir = Literal["asc", "desc"]


class ChampionResponse(BaseModel):
    """DTO representing a champion in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    champion_class: str
    image_url: str | None = None
    is_7_stars_available: bool = False
    is_ascendable: bool = False
    has_prefight: bool = False
    alias: str | None = None
    # Only meaningful when the query carried a season_id; false otherwise.
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class ChampionFilters(BaseModel):
    """Filtering and ordering options for the champion listing."""

    champion_class: str | None = None
    search: str | None = None
    is_7_stars_available: bool | None = None
    is_ascendable: bool | None = None
    has_prefight: bool | None = None
    season_id: uuid.UUID | None = None
    is_saga_attacker: bool | None = None
    is_saga_defender: bool | None = None
    order_by: ChampionOrderBy = "name"
    order_dir: ChampionOrderDir = "asc"

    @property
    def needs_saga_join(self) -> bool:
        return self.season_id is not None


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
    is_7_stars_available: bool | None = None
    is_ascendable: bool | None = None
    has_prefight: bool | None = None
    alias: str | None = Field(default=None, max_length=500)
