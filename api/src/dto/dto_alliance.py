import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.AllianceOfficer import AllianceOfficer
    from src.models.GameAccount import GameAccount


class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. The owner is the game account that creates it."""
    name: str = Field(..., max_length=100, examples=["My Alliance"])
    tag: str = Field(..., max_length=10, examples=["ALLY"])
    owner_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceMemberResponse(BaseModel):
    """A member of an alliance (game account with group info)."""
    id: uuid.UUID
    user_id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int] = None
    is_owner: bool = False
    is_officer: bool = False

    @classmethod
    def from_model(
        cls,
        m: "GameAccount",
        *,
        owner_id: uuid.UUID,
        officer_ids: set[uuid.UUID],
    ) -> "AllianceMemberResponse":
        """Build from a GameAccount member in the context of an alliance."""
        return cls(
            id=m.id,
            user_id=m.user_id,
            game_pseudo=m.game_pseudo,
            alliance_group=m.alliance_group,
            is_owner=(m.id == owner_id),
            is_officer=(m.id in officer_ids),
        )


class AllianceOfficerResponse(BaseModel):
    id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    assigned_at: datetime

    @classmethod
    def from_model(cls, adj: "AllianceOfficer") -> "AllianceOfficerResponse":
        return cls(
            id=adj.id,
            game_account_id=adj.game_account_id,
            game_pseudo=adj.game_account.game_pseudo,
            assigned_at=adj.assigned_at,
        )


class AllianceResponse(BaseModel):
    id: uuid.UUID
    name: str
    tag: str
    owner_id: uuid.UUID
    owner_pseudo: str
    created_at: datetime
    officers: list[AllianceOfficerResponse] = []
    members: list[AllianceMemberResponse] = []
    member_count: int = 0

    @classmethod
    def from_model(cls, alliance: "Alliance") -> "AllianceResponse":
        """Build from an Alliance with `.owner`, `.officers`, `.members` loaded."""
        officer_ids = {adj.game_account_id for adj in alliance.officers}
        return cls(
            id=alliance.id,
            name=alliance.name,
            tag=alliance.tag,
            owner_id=alliance.owner_id,
            owner_pseudo=alliance.owner.game_pseudo,
            created_at=alliance.created_at,
            officers=[
                AllianceOfficerResponse.from_model(adj)
                for adj in alliance.officers
            ],
            members=[
                AllianceMemberResponse.from_model(
                    m, owner_id=alliance.owner_id, officer_ids=officer_ids,
                )
                for m in alliance.members
            ],
            member_count=len(alliance.members),
        )


class AllianceAddOfficerRequest(BaseModel):
    """DTO to add an adjoint (deputy) to an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceRemoveOfficerRequest(BaseModel):
    """DTO to remove an adjoint from an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceAddMemberRequest(BaseModel):
    """DTO to add a game account as member of the alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceSetGroupRequest(BaseModel):
    """DTO to assign a member to a group (1, 2, 3) or remove from group (null)."""
    group: Optional[int] = Field(None, ge=1, le=3, examples=[1])


class AllianceRoleEntry(BaseModel):
    """Role information for the current user in a specific alliance."""
    is_owner: bool = False
    is_officer: bool = False
    can_manage: bool = False


class AllianceMyRolesResponse(BaseModel):
    """All alliance roles for the current user, plus their game account IDs."""
    roles: dict[str, AllianceRoleEntry] = {}
    my_account_ids: list[str] = []
