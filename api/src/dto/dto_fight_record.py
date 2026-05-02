import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, model_validator


class WarFightSynergyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    ascension: int

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "ascension": data.ascension,
        }


class WarFightPrefightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    ascension: int

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "ascension": data.ascension,
        }


class WarFightRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    alliance_id: uuid.UUID
    season_id: Optional[uuid.UUID] = None
    game_account_pseudo: str
    battlegroup: int
    node_number: int
    tier: int
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    rank: int
    ascension: int
    is_saga_attacker: bool
    defender_champion_id: uuid.UUID
    defender_champion_name: str
    defender_champion_class: str
    defender_image_url: Optional[str] = None
    defender_stars: int
    defender_rank: int
    defender_ascension: int
    defender_is_saga_defender: bool
    ko_count: int
    synergies: List[WarFightSynergyResponse] = []
    prefights: List[WarFightPrefightResponse] = []
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "war_id": data.war_id,
            "alliance_id": data.alliance_id,
            "season_id": data.season_id,
            "game_account_pseudo": data.game_account.game_pseudo,
            "battlegroup": data.battlegroup,
            "node_number": data.node_number,
            "tier": data.tier,
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "rank": data.rank,
            "ascension": data.ascension,
            "is_saga_attacker": data.is_saga_attacker,
            "defender_champion_id": data.defender_champion_id,
            "defender_champion_name": data.defender_champion.name,
            "defender_champion_class": data.defender_champion.champion_class,
            "defender_image_url": data.defender_champion.image_url,
            "defender_stars": data.defender_stars,
            "defender_rank": data.defender_rank,
            "defender_ascension": data.defender_ascension,
            "defender_is_saga_defender": data.defender_is_saga_defender,
            "ko_count": data.ko_count,
            "synergies": data.synergies,
            "prefights": data.prefights,
            "created_at": data.created_at,
        }
