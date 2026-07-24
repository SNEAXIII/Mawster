import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class ChampionUserSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: str | None = None
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


# Aliases kept for backwards compatibility
WarFightSynergyResponse = ChampionUserSnapshotResponse
WarFightPrefightResponse = ChampionUserSnapshotResponse


class WarFightRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_imported: bool = False
    war_id: uuid.UUID | None = None
    alliance_id: uuid.UUID
    season_id: uuid.UUID | None = None
    game_account_pseudo: str | None = None
    battlegroup: int | None = None
    node_number: int
    tier: int | None = None
    alliance_name: str
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: str | None = None
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
    synergies: list[WarFightSynergyResponse] = []
    prefights: list[WarFightPrefightResponse] = []
    created_at: datetime | None = None
    note: str | None = None
    note_id: uuid.UUID | None = None
    note_blocked: bool = False
    note_author: str | None = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        from src.models.WarFightRecordImport import WarFightRecordImport as _WarFightRecordImport

        is_import = isinstance(data, _WarFightRecordImport)
        if is_import:
            return {
                "id": data.id,
                "is_imported": True,
                "war_id": None,
                "alliance_id": data.alliance_id,
                "alliance_name": data.alliance.name,
                "season_id": data.season_id,
                "game_account_pseudo": None,
                "battlegroup": None,
                "node_number": data.node_number,
                "tier": None,
                "champion_id": data.champion_id,
                "champion_name": data.champion.name,
                "champion_class": data.champion.champion_class,
                "image_url": data.champion.image_url,
                "stars": None,
                "rank": None,
                "ascension": None,
                "is_saga_attacker": None,
                "defender_champion_id": data.defender_champion_id,
                "defender_champion_name": data.defender_champion.name,
                "defender_champion_class": data.defender_champion.champion_class,
                "defender_image_url": data.defender_champion.image_url,
                "defender_stars": None,
                "defender_rank": None,
                "defender_ascension": None,
                "defender_is_saga_defender": None,
                "ko_count": data.ko_count,
                "is_planning_error": False,
                "assisted": False,
                "synergies": [],
                "prefights": [],
                "created_at": data.created_at,
                "note": None,
                "note_id": None,
                "note_blocked": False,
                "note_author": None,
            }
        return {
            "id": data.id,
            "is_imported": False,
            "war_id": data.war_id,
            "alliance_id": data.alliance_id,
            "alliance_name": data.alliance.name,
            "season_id": data.season_id,
            "game_account_pseudo": data.game_account.game_pseudo if data.game_account else None,
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
            "is_planning_error": data.is_planning_error,
            "assisted": data.assisted,
            "synergies": data.synergies,
            "prefights": data.prefights,
            "created_at": data.created_at,
            "note": None,
        }


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
