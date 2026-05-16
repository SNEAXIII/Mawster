import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.dto.alliance.war.dto_ranking_history import RankingHistoryPoint, RankingHistoryResponse
from src.models.Alliance import Alliance
from src.models.Season import Season
from src.models.User import User
from src.models.War import War, WarStatus
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import SessionDep


class RankingHistoryService:
    @staticmethod
    def _reconstruct_elo(wars: list[War], current_elo: int) -> list[RankingHistoryPoint]:
        if not wars:
            return []
        points: list[RankingHistoryPoint] = []
        elo = current_elo
        for war in reversed(wars):
            change = war.elo_change or 0
            points.append(
                RankingHistoryPoint(
                    war_number=0,
                    opponent_name=war.opponent_name,
                    tier=war.tier,
                    elo_after=elo,
                    win=war.win,
                )
            )
            elo -= change
        points.reverse()
        for i, point in enumerate(points):
            point.war_number = i + 1
        return points

    @classmethod
    async def get_ranking_history(
        cls,
        session: SessionDep,
        current_user: User,
        alliance_id: uuid.UUID,
    ) -> RankingHistoryResponse:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

        active_season = (
            await session.exec(select(Season).where(Season.is_active == True))  # noqa: E712
        ).first()

        if active_season is None:
            return RankingHistoryResponse(season_number=None, points=[])

        wars = (
            await session.exec(
                select(War)
                .where(
                    War.alliance_id == alliance_id,
                    War.season_id == active_season.id,
                    War.status == WarStatus.ended,
                )
                .order_by(War.created_at)
            )
        ).all()

        points = cls._reconstruct_elo(list(wars), alliance.elo)
        return RankingHistoryResponse(season_number=active_season.number, points=points)
