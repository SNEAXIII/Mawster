import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field

KO = -10
FIGHT = 2
MINIBOSS = 4
BOSS = 5


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

    @computed_field
    @property
    def score(self) -> float:
        fights = self.total_fights - self.total_miniboss - self.total_boss
        return self.total_kos * KO + fights * FIGHT + self.total_miniboss * MINIBOSS + self.total_boss * BOSS
