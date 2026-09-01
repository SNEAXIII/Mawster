import uuid

from pydantic import BaseModel, ConfigDict

# Each not-done fight is counted as a fight carrying this many KOs in the ratio.
NOT_FOUGHT_KOS = 3


class PlayerSeasonStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_pseudo: str
    alliance_group: int | None = None
    total_kos: int
    total_fights: float
    total_fights_weighted: float = 0.0
    total_assists: int = 0
    total_times_helped: int = 0
    total_miniboss: int
    total_boss: int
    total_not_fought: int
    ratio: int
    wars_participated: int
    avg_fights_per_war: float
    avg_boss_miniboss_per_war: float
    is_current_member: bool


class ChampionUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    fight_count: int
    total_kos: int
    image_url: str | None = None
