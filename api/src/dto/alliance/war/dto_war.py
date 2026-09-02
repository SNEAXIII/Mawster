import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.dto.admin.dto_champion import ChampionResponse
from src.dto.mixins import PlayerIdentity, WarCoords
from src.game_types import Ascension, KoCount, NodeNumber, Rank, Stars
from src.Messages.war_messages import BANNED_CHAMPION_LIST_TOO_LONG

MAX_BANNED_CHAMPIONS = 7


def _champion_user_fields(champion_user: Any, prefix: str) -> dict[str, Any]:
    """Flatten a ChampionUser into ``{prefix}_*`` keys, or nothing when it is not set.

    Missing keys fall back to the model defaults (``None``), which keeps the
    caller free of one ternary per field.
    """
    if champion_user is None:
        return {}
    return {
        f"{prefix}_game_account_id": champion_user.game_account_id,
        f"{prefix}_pseudo": champion_user.game_account.game_pseudo,
        f"{prefix}_champion_name": champion_user.champion.name,
        f"{prefix}_champion_class": champion_user.champion.champion_class,
        f"{prefix}_image_url": champion_user.champion.image_url,
        f"{prefix}_rarity": f"{champion_user.stars}r{champion_user.rank}",
        f"{prefix}_ascension": champion_user.ascension,
    }


class WarCreateRequest(BaseModel):
    opponent_name: str = Field(..., max_length=100, min_length=1)
    banned_champion_ids: list[uuid.UUID] = Field(
        default_factory=list,
        max_length=MAX_BANNED_CHAMPIONS,
        description=BANNED_CHAMPION_LIST_TOO_LONG,
    )


class WarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    opponent_name: str
    status: str
    created_by_pseudo: str
    created_at: datetime
    banned_champions: list[ChampionResponse] = []
    season_id: uuid.UUID | None = None
    season_number: int | None = None
    win: bool | None = None
    elo_change: int | None = None
    tier: int | None = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "alliance_id": data.alliance_id,
            "opponent_name": data.opponent_name,
            "status": data.status,
            "created_by_pseudo": data.created_by.game_pseudo,
            "created_at": data.created_at,
            "banned_champions": [ban.champion for ban in data.bans],
            "season_id": data.season_id,
            "season_number": data.season.number if data.season else None,
            "win": data.win,
            "elo_change": data.elo_change,
            "tier": data.tier,
        }


class WarPlacementCreateRequest(BaseModel):
    node_number: NodeNumber
    champion_id: uuid.UUID
    stars: Stars
    rank: Rank
    ascension: Ascension = 0


class WarPlacementResponse(WarCoords):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: str | None = None
    rarity: str
    ascension: int
    placed_by_pseudo: str | None = None
    created_at: datetime
    note: str | None = None
    note_id: uuid.UUID | None = None
    note_blocked: bool = False
    ko_count: int = 0
    is_combat_completed: bool = False
    is_fight_not_done: bool = False
    is_planning_error: bool = False
    attacker_champion_user_id: uuid.UUID | None = None
    attacker_game_account_id: uuid.UUID | None = None
    attacker_pseudo: str | None = None
    attacker_champion_name: str | None = None
    attacker_champion_class: str | None = None
    attacker_image_url: str | None = None
    attacker_rarity: str | None = None
    attacker_is_preferred_attacker: bool | None = None
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    attacker_ascension: int | None = None
    attacker_is_saga_attacker: bool | None = None
    attacker_is_saga_defender: bool | None = None
    is_assisted: bool = False
    assistor_champion_user_id: uuid.UUID | None = None
    assistor_game_account_id: uuid.UUID | None = None
    assistor_pseudo: str | None = None
    assistor_champion_name: str | None = None
    assistor_champion_class: str | None = None
    assistor_image_url: str | None = None
    assistor_rarity: str | None = None
    assistor_ascension: int | None = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        attacker = data.attacker_champion_user
        return {
            "id": data.id,
            "war_id": data.war_id,
            "battlegroup": data.battlegroup,
            "node_number": data.node_number,
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "rarity": f"{data.stars}r{data.rank}",
            "ascension": data.ascension,
            "placed_by_pseudo": data.placed_by.game_pseudo if data.placed_by else None,
            "created_at": data.created_at,
            "note": getattr(data, "_note_content", None),
            "note_id": getattr(data, "_note_id", None),
            "note_blocked": getattr(data, "_note_blocked", False),
            "ko_count": data.ko_count,
            "is_combat_completed": data.is_combat_completed,
            "is_fight_not_done": data.is_fight_not_done,
            "is_planning_error": data.is_planning_error,
            "attacker_champion_user_id": data.attacker_champion_user_id,
            "attacker_is_preferred_attacker": attacker.is_preferred_attacker if attacker else None,
            "is_assisted": data.assist_champion_user_id is not None,
            "assistor_champion_user_id": data.assist_champion_user_id,
            **_champion_user_fields(attacker, "attacker"),
            **_champion_user_fields(data.assist_champion_user, "assistor"),
        }


class WarDefenseSummaryResponse(BaseModel):
    war_id: uuid.UUID
    battlegroup: int
    placements: list[WarPlacementResponse] = []


class WarAttackerAssignRequest(BaseModel):
    champion_user_id: uuid.UUID


class WarKoUpdateRequest(BaseModel):
    ko_count: KoCount


class AvailableAttackerResponse(PlayerIdentity):
    champion_user_id: uuid.UUID
    champion_id: uuid.UUID
    champion_name: str
    champion_alias: str | None = None
    champion_class: str
    image_url: str | None = None
    rarity: str
    ascension: int
    signature: int
    is_preferred_attacker: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class AvailablePrefightAttackerResponse(PlayerIdentity):
    model_config = ConfigDict(from_attributes=True)
    champion_user_id: uuid.UUID
    champion_id: uuid.UUID
    champion_name: str
    champion_alias: str | None = None
    champion_class: str
    image_url: str | None = None
    rarity: str
    ascension: int = 0
    is_preferred_attacker: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class WarSynergyCreateRequest(BaseModel):
    champion_user_id: uuid.UUID
    target_champion_user_id: uuid.UUID


class WarSynergyResponse(PlayerIdentity):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    champion_user_id: uuid.UUID
    target_champion_user_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: str | None = None
    rarity: str
    ascension: int = 0
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    target_champion_name: str
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        cu = data.champion_user
        target = data.target_champion_user
        return {
            "id": data.id,
            "war_id": data.war_id,
            "battlegroup": data.battlegroup,
            "game_account_id": data.game_account_id,
            "champion_user_id": data.champion_user_id,
            "target_champion_user_id": data.target_champion_user_id,
            "champion_name": cu.champion.name,
            "champion_class": cu.champion.champion_class,
            "image_url": cu.champion.image_url,
            "rarity": cu.rarity,
            "ascension": cu.ascension,
            "target_champion_name": target.champion.name,
            "game_pseudo": data.game_account.game_pseudo,
            "created_at": data.created_at,
        }


class WarUpdateRequest(BaseModel):
    opponent_name: str = Field(..., max_length=100, min_length=1, pattern=r"^[a-zA-Z0-9 ]+$")
    banned_champion_ids: list[uuid.UUID] = Field(
        default_factory=list,
        max_length=MAX_BANNED_CHAMPIONS,
        description=BANNED_CHAMPION_LIST_TOO_LONG,
    )


class WarEndRequest(BaseModel):
    win: bool
    elo_change: int | None = None


class WarPrefightCreateRequest(BaseModel):
    champion_user_id: uuid.UUID
    target_node_number: NodeNumber


class WarPrefightResponse(PlayerIdentity):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    champion_user_id: uuid.UUID
    target_node_number: int
    champion_name: str
    champion_class: str
    image_url: str | None = None
    rarity: str
    ascension: int = 0
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        cu = data.champion_user
        return {
            "id": data.id,
            "war_id": data.war_id,
            "battlegroup": data.battlegroup,
            "game_account_id": data.game_account_id,
            "champion_user_id": data.champion_user_id,
            "target_node_number": data.target_node_number,
            "champion_name": cu.champion.name,
            "champion_class": cu.champion.champion_class,
            "image_url": cu.champion.image_url,
            "rarity": cu.rarity,
            "ascension": cu.ascension,
            "game_pseudo": data.game_account.game_pseudo,
            "created_at": data.created_at,
        }
