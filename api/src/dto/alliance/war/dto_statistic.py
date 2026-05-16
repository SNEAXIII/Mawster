import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field

KO = -10
FIGHT = 2
MINIBOSS = 4
BOSS = 5
NOT_FOUGHT_KOS = 3


class PlayerSeasonStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int]
    total_kos: int
    total_fights: int
    total_miniboss: int
    total_boss: int
    total_not_fought: int
    ratio: int
    wars_participated: int
    avg_fights_per_war: float
    avg_boss_miniboss_per_war: float
    is_current_member: bool

    @computed_field
    @property
    def score(self) -> float:
        fights = self.total_fights - self.total_miniboss - self.total_boss
        return (
            self.total_kos * KO
            + fights * FIGHT
            + self.total_miniboss * MINIBOSS
            + self.total_boss * BOSS
            + self.total_not_fought * NOT_FOUGHT_KOS * KO
        )


class ChampionUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    fight_count: int
    total_kos: int
    image_url: Optional[str] = None
