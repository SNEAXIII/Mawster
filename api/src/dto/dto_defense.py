import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DefensePlacementCreateRequest(BaseModel):
    """Place a champion on a defense node."""
    node_number: int = Field(..., ge=1, le=55)
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID


class DefensePlacementBulkRequest(BaseModel):
    """Place multiple defenders at once."""
    placements: list[DefensePlacementCreateRequest] = Field(..., min_length=1)


class DefensePlacementResponse(BaseModel):
    """DTO for a defense placement with resolved relations."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    battlegroup: int
    node_number: int
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    champion_name: str
    champion_alias: Optional[str] = None
    champion_class: str
    champion_image_url: Optional[str] = None
    rarity: str
    signature: int = 0
    is_preferred_attacker: bool = False
    ascension: int = 0
    is_saga_attacker: bool = False
    is_saga_defender: bool = False
    placed_by_id: Optional[uuid.UUID] = None
    placed_by_pseudo: Optional[str] = None
    created_at: datetime

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        """Flatten `.game_account`, `.champion_user.champion`, `.placed_by` relations."""
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'alliance_id': data.alliance_id,
            'battlegroup': data.battlegroup,
            'node_number': data.node_number,
            'champion_user_id': data.champion_user_id,
            'game_account_id': data.game_account_id,
            'game_pseudo': data.game_account.game_pseudo,
            'champion_name': data.champion_user.champion.name,
            'champion_alias': data.champion_user.champion.alias,
            'champion_class': data.champion_user.champion.champion_class,
            'champion_image_url': data.champion_user.champion.image_url,
            'rarity': data.champion_user.rarity,
            'signature': data.champion_user.signature,
            'is_preferred_attacker': data.champion_user.is_preferred_attacker,
            'ascension': data.champion_user.ascension,
            'is_saga_attacker': data.champion_user.champion.is_saga_attacker,
            'is_saga_defender': data.champion_user.champion.is_saga_defender,
            'placed_by_id': data.placed_by_id,
            'placed_by_pseudo': data.placed_by.game_pseudo if data.placed_by else None,
            'created_at': data.created_at,
        }


class DefenseSummaryResponse(BaseModel):
    """Full defense view for an alliance battlegroup."""
    alliance_id: uuid.UUID
    battlegroup: int
    placements: list[DefensePlacementResponse] = []
    member_defender_counts: dict[str, int] = {}  # game_account_id → count


class DefenderAssignmentRequest(BaseModel):
    """Officer assigns a specific champion to a specific player (pre-assignment)."""
    champion_id: uuid.UUID
    game_account_id: uuid.UUID


class DefenderAssignmentResponse(BaseModel):
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    champion_image_url: Optional[str] = None
    game_account_id: uuid.UUID
    game_pseudo: str


# ─── Defense export / import ──────────────────────────────────────────────────


class DefenseExportItem(BaseModel):
    """One placement in portable JSON form (no IDs)."""
    champion_name: str
    rarity: str
    node_number: int
    owner_name: str


class DefenseReportItem(BaseModel):
    """One placement in the import report — includes visual fields."""
    champion_name: str
    champion_class: Optional[str] = None
    champion_image_url: Optional[str] = None
    rarity: str
    node_number: int
    owner_name: str


class DefenseImportRequest(BaseModel):
    """Payload to import a full defense from JSON."""
    placements: list[DefenseExportItem] = Field(..., min_length=1)


class DefenseImportError(BaseModel):
    """One failed placement during import."""
    node_number: int
    champion_name: str
    owner_name: str
    reason: str


class DefenseImportReport(BaseModel):
    """Result returned after an import operation."""
    before: list[DefenseReportItem]
    after: list[DefenseReportItem]
    errors: list[DefenseImportError]
    success_count: int
    error_count: int
    error_count: int
