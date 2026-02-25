import uuid
from typing import Optional
from pydantic import BaseModel, Field


class ChampionResponse(BaseModel):
    """DTO representing a champion in API responses."""
    id: uuid.UUID
    name: str
    champion_class: str
    image_url: Optional[str] = None
    is_7_star: bool = False
    alias: Optional[str] = None


class ChampionAdminViewAll(BaseModel):
    """Paginated list of champions for admin view."""
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
