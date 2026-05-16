from typing import Optional
from pydantic import BaseModel


class RankingHistoryPoint(BaseModel):
    war_number: int
    opponent_name: str
    tier: Optional[int]
    elo_after: int
    win: Optional[bool]


class RankingHistoryResponse(BaseModel):
    season_number: Optional[int]
    points: list[RankingHistoryPoint]
