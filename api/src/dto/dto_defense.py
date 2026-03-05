import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.DefensePlacement import DefensePlacement


class DefensePlacementCreateRequest(BaseModel):
    """Place a champion on a defense node."""
    node_number: int = Field(..., ge=1, le=55)
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID


class DefensePlacementBulkRequest(BaseModel):
    """Place multiple defenders at once."""
    placements: list[DefensePlacementCreateRequest] = Field(..., min_length=1)


class DefensePlacementResponse(BaseModel):
    id: uuid.UUID
    alliance_id: uuid.UUID
    battlegroup: int
    node_number: int
    champion_user_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    champion_name: str
    champion_class: str
    champion_image_url: Optional[str] = None
    rarity: str
    signature: int = 0
    is_preferred_attacker: bool = False
    ascension: int = 0
    placed_by_id: Optional[uuid.UUID] = None
    placed_by_pseudo: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_model(cls, p: "DefensePlacement") -> "DefensePlacementResponse":
        """Build from a DefensePlacement with relations loaded."""
        return cls(
            id=p.id,
            alliance_id=p.alliance_id,
            battlegroup=p.battlegroup,
            node_number=p.node_number,
            champion_user_id=p.champion_user_id,
            game_account_id=p.game_account_id,
            game_pseudo=p.game_account.game_pseudo,
            champion_name=p.champion_user.champion.name,
            champion_class=p.champion_user.champion.champion_class,
            champion_image_url=p.champion_user.champion.image_url,
            rarity=p.champion_user.rarity,
            signature=p.champion_user.signature,
            is_preferred_attacker=p.champion_user.is_preferred_attacker,
            ascension=p.champion_user.ascension,
            placed_by_id=p.placed_by_id,
            placed_by_pseudo=p.placed_by.game_pseudo if p.placed_by else None,
            created_at=p.created_at,
        )


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
