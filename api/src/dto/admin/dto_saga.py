import uuid

from pydantic import BaseModel, ConfigDict


class SagaRoleUpsertRequest(BaseModel):
    """DTO to upsert a champion's saga attacker/defender flags for a season."""

    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class SagaRoleResponse(BaseModel):
    """DTO representing a champion's saga role for a season."""

    model_config = ConfigDict(from_attributes=True)

    season_id: uuid.UUID
    champion_id: uuid.UUID
    is_saga_attacker: bool
    is_saga_defender: bool
