import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PlayerSeasonStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int]
    total_kos: int
    total_fights: int
    total_miniboss: int
    total_boss: int
    ratio: int
    ratio_mb: int
