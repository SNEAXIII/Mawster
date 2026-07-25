from pydantic import BaseModel

from src.enums.SeasonStatus import SeasonStatus


class RankingHistoryPoint(BaseModel):
    war_number: int
    opponent_name: str
    tier: int | None = None
    elo_after: int
    win: bool | None = None


class RankingHistoryResponse(BaseModel):
    season_number: int | None = None
    season_status: SeasonStatus | None = None
    points: list[RankingHistoryPoint]
