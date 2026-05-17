from typing import Optional
from pydantic import BaseModel


class RankingHistoryPoint(BaseModel):
    war_number: int
    opponent_name: str
    tier: Optional[int] = None
    elo_after: int
    win: Optional[bool] = None


class RankingHistoryResponse(BaseModel):
    season_number: Optional[int] = None
    points: list[RankingHistoryPoint]
