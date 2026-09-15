import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from src.dto.mixins import ChampionRef
from src.enums.WarBoost import WarBoost


class ChampionUserSnapshotResponse(ChampionRef):
    stars: int
    ascension: int

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        cu = data.champion_user
        return {
            "champion_id": cu.champion_id,
            "champion_name": cu.champion.name,
            "champion_class": cu.champion.champion_class,
            "image_url": cu.champion.image_url,
            "stars": cu.stars,
            "ascension": cu.ascension,
        }


# Aliases kept for backwards compatibility
WarFightSynergyResponse = ChampionUserSnapshotResponse
WarFightPrefightResponse = ChampionUserSnapshotResponse


class WarFightRecordResponse(ChampionRef):
    id: uuid.UUID
    is_imported: bool = False
    war_id: uuid.UUID | None = None
    alliance_id: uuid.UUID
    season_id: uuid.UUID | None = None
    season_number: int | None = None
    game_account_pseudo: str | None = None
    battlegroup: int | None = None
    node_number: int
    tier: int | None = None
    alliance_name: str
    alliance_tag: str | None = None
    stars: int | None = None
    rank: int | None = None
    ascension: int | None = None
    is_saga_attacker: bool | None = None
    defender_champion_id: uuid.UUID
    defender_champion_name: str
    defender_champion_class: str
    defender_image_url: str | None = None
    defender_stars: int | None = None
    defender_rank: int | None = None
    defender_ascension: int | None = None
    defender_is_saga_defender: bool | None = None
    ko_count: int
    is_planning_error: bool = False
    assisted: bool = False
    war_boost: WarBoost | None = None
    has_defense_boost: bool = False
    has_power_boost: bool = False
    has_specials_boost: bool = False
    # Field(), not a bare [], because RUF012 no longer sees a BaseModel base here.
    # default_factory would drop `"default": []` from the OpenAPI schema; this keeps it.
    synergies: list[WarFightSynergyResponse] = Field(default=[])
    prefights: list[WarFightPrefightResponse] = Field(default=[])
    created_at: datetime | None = None
    note: str | None = None
    note_id: uuid.UUID | None = None
    note_blocked: bool = False
    note_author: str | None = None


class PaginatedFightRecordsResponse(BaseModel):
    items: list[WarFightRecordResponse]
    total: int
    page: int
    size: int
    pages: int


class ForceSnapshotResponse(BaseModel):
    snapshotted: int
    skipped: int


class AllianceSnapshotStatResponse(BaseModel):
    alliance_id: uuid.UUID
    alliance_name: str
    war_count: int
