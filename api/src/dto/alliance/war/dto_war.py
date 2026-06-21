import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.Messages.war_messages import BANNED_CHAMPION_LIST_TOO_LONG
from src.dto.admin.dto_champion import ChampionResponse

MAX_BANNED_CHAMPIONS = 7


class WarCreateRequest(BaseModel):
    opponent_name: str = Field(..., max_length=100, min_length=1, pattern=r"^[a-zA-Z0-9 ]+$")
    banned_champion_ids: List[uuid.UUID] = Field(
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
    banned_champions: List[ChampionResponse] = []
    season_id: Optional[uuid.UUID] = None
    season_number: Optional[int] = None
    win: Optional[bool] = None
    elo_change: Optional[int] = None
    tier: Optional[int] = None

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
    node_number: int = Field(..., ge=1, le=50)
    champion_id: uuid.UUID
    stars: int = Field(..., ge=6, le=7)
    rank: int = Field(..., ge=1, le=6)
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
    note: Optional[str] = None
    note_id: Optional[uuid.UUID] = None
    note_blocked: bool = False
    ko_count: int = 0
    is_combat_completed: bool = False
    is_fight_not_done: bool = False
    is_planning_error: bool = False
    attacker_champion_user_id: Optional[uuid.UUID] = None
    attacker_game_account_id: Optional[uuid.UUID] = None
    attacker_pseudo: Optional[str] = None
    attacker_champion_name: Optional[str] = None
    attacker_champion_class: Optional[str] = None
    attacker_image_url: Optional[str] = None
    attacker_rarity: Optional[str] = None
    attacker_is_preferred_attacker: Optional[bool] = None
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    attacker_ascension: Optional[int] = None
    attacker_is_saga_attacker: Optional[bool] = None
    attacker_is_saga_defender: Optional[bool] = None
    is_assisted: bool = False
    assistor_champion_user_id: Optional[uuid.UUID] = None
    assistor_game_account_id: Optional[uuid.UUID] = None
    assistor_pseudo: Optional[str] = None
    assistor_champion_name: Optional[str] = None
    assistor_champion_class: Optional[str] = None
    assistor_image_url: Optional[str] = None
    assistor_rarity: Optional[str] = None
    assistor_ascension: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        attacker = data.attacker_champion_user
        assistor = data.assist_champion_user
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
            "attacker_game_account_id": attacker.game_account_id if attacker else None,
            "attacker_pseudo": attacker.game_account.game_pseudo if attacker else None,
            "attacker_champion_name": attacker.champion.name if attacker else None,
            "attacker_champion_class": attacker.champion.champion_class if attacker else None,
            "attacker_image_url": attacker.champion.image_url if attacker else None,
            "attacker_rarity": f"{attacker.stars}r{attacker.rank}" if attacker else None,
            "attacker_is_preferred_attacker": attacker.is_preferred_attacker if attacker else None,
            "is_saga_attacker": data.champion.is_saga_attacker,
            "is_saga_defender": data.champion.is_saga_defender,
            "attacker_ascension": attacker.ascension if attacker else None,
            "attacker_is_saga_attacker": attacker.champion.is_saga_attacker if attacker else None,
            "attacker_is_saga_defender": attacker.champion.is_saga_defender if attacker else None,
            "is_assisted": data.assist_champion_user_id is not None,
            "assistor_champion_user_id": data.assist_champion_user_id,
            "assistor_game_account_id": assistor.game_account_id if assistor else None,
            "assistor_pseudo": assistor.game_account.game_pseudo if assistor else None,
            "assistor_champion_name": assistor.champion.name if assistor else None,
            "assistor_champion_class": assistor.champion.champion_class if assistor else None,
            "assistor_image_url": assistor.champion.image_url if assistor else None,
            "assistor_rarity": f"{assistor.stars}r{assistor.rank}" if assistor else None,
            "assistor_ascension": assistor.ascension if assistor else None,
        }


class WarDefenseSummaryResponse(BaseModel):
    war_id: uuid.UUID
    battlegroup: int
    placements: list[WarPlacementResponse] = []


class WarAttackerAssignRequest(BaseModel):
    champion_user_id: uuid.UUID


class WarKoUpdateRequest(BaseModel):
    ko_count: int = Field(..., ge=0)


class AvailableAttackerResponse(BaseModel):
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    champion_id: uuid.UUID
    champion_name: str
    champion_alias: Optional[str] = None
    champion_class: str
    image_url: Optional[str] = None
    rarity: str
    ascension: int
    signature: int
    is_preferred_attacker: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class AvailablePrefightAttackerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    champion_id: uuid.UUID
    champion_name: str
    champion_alias: Optional[str] = None
    champion_class: str
    image_url: Optional[str] = None
    rarity: str
    ascension: int = 0
    is_preferred_attacker: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class WarSynergyCreateRequest(BaseModel):
    champion_user_id: uuid.UUID
    target_champion_user_id: uuid.UUID


class WarSynergyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    game_account_id: uuid.UUID
    champion_user_id: uuid.UUID
    target_champion_user_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    rarity: str
    ascension: int = 0
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    target_champion_name: str
    game_pseudo: str
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
            "is_saga_attacker": cu.champion.is_saga_attacker,
            "is_saga_defender": cu.champion.is_saga_defender,
            "target_champion_name": target.champion.name,
            "game_pseudo": data.game_account.game_pseudo,
            "created_at": data.created_at,
        }


class WarUpdateRequest(BaseModel):
    opponent_name: str = Field(..., max_length=100, min_length=1, pattern=r"^[a-zA-Z0-9 ]+$")
    banned_champion_ids: List[uuid.UUID] = Field(
        default_factory=list,
        max_length=MAX_BANNED_CHAMPIONS,
        description=BANNED_CHAMPION_LIST_TOO_LONG,
    )


class WarEndRequest(BaseModel):
    win: bool
    elo_change: Optional[int] = None


class WarPrefightCreateRequest(BaseModel):
    champion_user_id: uuid.UUID
    target_node_number: int = Field(..., ge=1, le=50)


class WarPrefightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    game_account_id: uuid.UUID
    champion_user_id: uuid.UUID
    target_node_number: int
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    rarity: str
    ascension: int = 0
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    game_pseudo: str
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
            "is_saga_attacker": cu.champion.is_saga_attacker,
            "is_saga_defender": cu.champion.is_saga_defender,
            "game_pseudo": data.game_account.game_pseudo,
            "created_at": data.created_at,
        }
