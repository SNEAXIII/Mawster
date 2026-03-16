import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WarCreateRequest(BaseModel):
    opponent_name: str = Field(..., max_length=100, min_length=1)


class WarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    opponent_name: str
    status: str
    created_by_pseudo: str
    created_at: datetime

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'alliance_id': data.alliance_id,
            'opponent_name': data.opponent_name,
            'status': data.status,
            'created_by_pseudo': data.created_by.game_pseudo,
            'created_at': data.created_at,
        }


class WarPlacementCreateRequest(BaseModel):
    node_number: int = Field(..., ge=1, le=55)
    champion_id: uuid.UUID
    stars: int = Field(..., ge=6, le=7)
    rank: int = Field(..., ge=1, le=5)
    ascension: int = Field(default=0, ge=0, le=2)


class WarPlacementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    node_number: int
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    rarity: str
    ascension: int
    placed_by_pseudo: Optional[str] = None
    created_at: datetime

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'war_id': data.war_id,
            'battlegroup': data.battlegroup,
            'node_number': data.node_number,
            'champion_id': data.champion_id,
            'champion_name': data.champion.name,
            'champion_class': data.champion.champion_class,
            'image_url': data.champion.image_url,
            'rarity': f"{data.stars}r{data.rank}",
            'ascension': data.ascension,
            'placed_by_pseudo': data.placed_by.game_pseudo if data.placed_by else None,
            'created_at': data.created_at,
        }


class WarDefenseSummaryResponse(BaseModel):
    war_id: uuid.UUID
    battlegroup: int
    placements: list[WarPlacementResponse] = []
