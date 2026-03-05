import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. The owner is the game account that creates it."""
    name: str = Field(..., max_length=100, examples=["My Alliance"])
    tag: str = Field(..., max_length=10, examples=["ALLY"])
    owner_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceMemberResponse(BaseModel):
    """A member of an alliance (game account with group info)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int] = None
    is_owner: bool = False
    is_officer: bool = False


class AllianceOfficerResponse(BaseModel):
    """An officer (adjoint) of an alliance."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    assigned_at: datetime

    @model_validator(mode='before')
    @classmethod
    def flatten_game_account(cls, data: Any) -> Any:
        """Flatten `.game_account.game_pseudo` into top-level field."""
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'game_account_id': data.game_account_id,
            'game_pseudo': data.game_account.game_pseudo,
            'assigned_at': data.assigned_at,
        }


class AllianceResponse(BaseModel):
    """Full alliance response with members and officers."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    tag: str
    owner_id: uuid.UUID
    owner_pseudo: str
    created_at: datetime
    officers: list[AllianceOfficerResponse] = []
    members: list[AllianceMemberResponse] = []
    member_count: int = 0

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        """Flatten `.owner`, `.officers`, `.members` relationships."""
        if isinstance(data, dict):
            return data
        officer_ids = {adj.game_account_id for adj in data.officers}
        return {
            'id': data.id,
            'name': data.name,
            'tag': data.tag,
            'owner_id': data.owner_id,
            'owner_pseudo': data.owner.game_pseudo,
            'created_at': data.created_at,
            'officers': [
                AllianceOfficerResponse.model_validate(adj)
                for adj in data.officers
            ],
            'members': [
                {
                    'id': m.id,
                    'user_id': m.user_id,
                    'game_pseudo': m.game_pseudo,
                    'alliance_group': m.alliance_group,
                    'is_owner': m.id == data.owner_id,
                    'is_officer': m.id in officer_ids,
                }
                for m in data.members
            ],
            'member_count': len(data.members),
        }


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
