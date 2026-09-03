import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.dto.mixins import PlayerIdentity
from src.game_types import Battlegroup, Tier


class AllianceCreateRequest(BaseModel):
    """DTO to create a new alliance. The owner is the game account that creates it."""

    name: str = Field(
        ..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9 ]+$", examples=["My Alliance"]
    )
    tag: str = Field(..., min_length=1, max_length=5, pattern=r"^[a-zA-Z0-9]+$", examples=["ALLY"])
    owner_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceMemberResponse(BaseModel):
    """A member of an alliance (game account with group info)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_pseudo: str
    alliance_group: int | None = None
    is_owner: bool = False
    is_officer: bool = False
    is_strategist: bool = False


class AllianceOfficerResponse(PlayerIdentity):
    """An officer (officer) of an alliance."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assigned_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_game_account(cls, data: Any) -> Any:
        """Flatten `.game_account.game_pseudo` into top-level field."""
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "game_account_id": data.game_account_id,
            "game_pseudo": data.game_account.game_pseudo,
            "assigned_at": data.assigned_at,
        }


class AlliancePublicFields(BaseModel):
    """What an Alliance shows to whoever holds no rank in it.

    Everything here is impersonal: no Player is named. The interior — who plays
    there and who leads it — lives in `AllianceResponse` and is reserved to the
    alliance's own members and Visitors.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    tag: str
    created_at: datetime
    elo: int = 0
    tier: int = 20
    member_count: int = 0


class AllianceListingResponse(AlliancePublicFields):
    """An Alliance seen from outside."""

    @model_validator(mode="before")
    @classmethod
    def count_members(cls, data: Any) -> Any:
        """Turn the members relationship into a count, and drop the rest.

        Only an ORM Alliance needs flattening: the endpoint that serves both this
        and `AllianceResponse` hands the union an already-built model, which must
        pass through untouched.
        """
        if isinstance(data, (dict, AlliancePublicFields)):
            return data
        return {
            "id": data.id,
            "name": data.name,
            "tag": data.tag,
            "created_at": data.created_at,
            "elo": data.elo,
            "tier": data.tier,
            "member_count": len(data.members),
        }


class AllianceResponse(AlliancePublicFields):
    """Full alliance response with members and officers."""

    owner_id: uuid.UUID
    owner_pseudo: str
    officers: list[AllianceOfficerResponse] = []
    members: list[AllianceMemberResponse] = []

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        """Flatten `.owner`, `.officers`, `.members` relationships.

        A dict or an already-built model passes through: the facade returned by
        `GET /alliances/{id}` reaches this union too, and has no relationships to
        flatten.
        """
        if isinstance(data, (dict, AlliancePublicFields)):
            return data
        officer_ids = {adj.game_account_id for adj in data.officers}
        strategist_ids = {s.game_account_id for s in data.strategists}
        return {
            "id": data.id,
            "name": data.name,
            "tag": data.tag,
            "owner_id": data.owner_id,
            "owner_pseudo": data.owner.game_pseudo,
            "created_at": data.created_at,
            "elo": data.elo,
            "tier": data.tier,
            "officers": [AllianceOfficerResponse.model_validate(adj) for adj in data.officers],
            "members": [
                {
                    "id": m.id,
                    "game_pseudo": m.game_pseudo,
                    "alliance_group": m.alliance_group,
                    "is_owner": m.id == data.owner_id,
                    "is_officer": m.id in officer_ids,
                    "is_strategist": m.id in strategist_ids,
                }
                for m in data.members
            ],
            "member_count": len(data.members),
        }


class AllianceAddOfficerRequest(BaseModel):
    """DTO to add an officer (deputy) to an alliance."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceRemoveOfficerRequest(BaseModel):
    """DTO to remove an officer from an alliance."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceAddStrategistRequest(BaseModel):
    """DTO to grant the strategist rank in an alliance."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceRemoveStrategistRequest(BaseModel):
    """DTO to revoke the strategist rank in an alliance."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceAddMemberRequest(BaseModel):
    """DTO to add a game account as member of the alliance."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceSetGroupRequest(BaseModel):
    """DTO to assign a member to a group (1, 2, 3) or remove from group (null)."""

    group: Battlegroup | None = Field(None, examples=[1])


class AllianceRoleEntry(BaseModel):
    """Role information for the current user in a specific alliance."""

    is_owner: bool = False
    is_officer: bool = False
    can_manage: bool = False
    is_strategist: bool = False
    can_place: bool = False


class AllianceMyRolesResponse(BaseModel):
    """All alliance roles for the current user, plus their game account IDs."""

    roles: dict[str, AllianceRoleEntry] = {}
    roles_by_account: dict[str, AllianceRoleEntry] = {}
    my_account_ids: list[str] = []


class AllianceTransferOwnerRequest(BaseModel):
    """DTO to transfer ownership to an existing officer."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceUpdateEloRequest(BaseModel):
    elo: int = Field(..., ge=0, le=4500)


class AllianceUpdateTierRequest(BaseModel):
    tier: Tier


class AllianceDeleteRequest(BaseModel):
    """DTO to delete (disband) an alliance.

    The caller must retype the alliance name: the confirmation travels with the
    request so the guard holds for any client, not just the web UI.
    """

    name: str = Field(..., min_length=3, max_length=50, examples=["My Alliance"])
