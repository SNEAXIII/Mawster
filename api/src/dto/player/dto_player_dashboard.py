import uuid

from pydantic import BaseModel

from src.dto.account.game.dto_upgrade_request import UpgradeRequestResponse
from src.dto.alliance.defense.dto_defense_plan import DefensePlanNodeResponse
from src.dto.alliance.dto_invitation import AllianceInvitationResponse


class PlayerDashboardAlliance(BaseModel):
    alliance_id: uuid.UUID
    name: str
    tag: str
    battlegroup: int | None = None


class PlayerDashboardWar(BaseModel):
    war_id: uuid.UUID
    opponent_name: str
    battlegroup: int
    is_ready: bool


class PlayerDashboardResponse(BaseModel):
    """What one Player has to act on right now."""

    invitations: list[AllianceInvitationResponse] = []
    upgrade_requests: list[UpgradeRequestResponse] = []
    alliance: PlayerDashboardAlliance | None = None
    defense: list[DefensePlanNodeResponse] = []
    war: PlayerDashboardWar | None = None
