from typing import Optional
from pydantic import BaseModel

from src.enums.SeasonStatus import SeasonStatus


class RankingHistoryPoint(BaseModel):
    war_number: int
    opponent_name: str
    tier: Optional[int] = None
    elo_after: int
    win: Optional[bool] = None


class RankingHistoryResponse(BaseModel):
    season_number: Optional[int] = None
    season_status: Optional[SeasonStatus] = None
    points: list[RankingHistoryPoint]
