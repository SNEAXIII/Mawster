import uuid

from pydantic import BaseModel, ConfigDict


class PlayerStatsCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ratio: int
    total_kos: int
    total_not_fought: int
    total_fights: float
    total_assists: int = 0
    wars_participated: int


class RatioEvolutionPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    label: str
    ratio: int
    fights: float


class PlayerSeasonAllianceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    tag: str


class PlayerStatsResponse(BaseModel):
    card: PlayerStatsCardResponse
    evolution: list[RatioEvolutionPoint]
    alliances: list[PlayerSeasonAllianceResponse]


class PlayerSeasonOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    season_id: uuid.UUID
    number: int
    status: str
