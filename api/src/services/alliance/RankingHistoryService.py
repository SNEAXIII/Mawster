import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.dto.alliance.war.dto_ranking_history import RankingHistoryPoint, RankingHistoryResponse
from src.enums.WarStatus import WarStatus
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models.alliance.Alliance import Alliance
from src.models.user.User import User
from src.models.war.War import War
from src.services.alliance.AllianceService import AllianceService
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep


class RankingHistoryService:
    @staticmethod
    def _reconstruct_elo(wars: list[War], current_elo: int) -> list[RankingHistoryPoint]:
        # Walk back from today's ELO, undoing each war's change.
        elo_after = []
        elo = current_elo
        for war in reversed(wars):
            elo_after.append(elo)
            elo -= war.elo_change or 0
        elo_after.reverse()
        return [
            RankingHistoryPoint(
                war_number=number,
                opponent_name=war.opponent_name,
                tier=war.tier,
                elo_after=after,
                win=war.win,
            )
            for number, (war, after) in enumerate(zip(wars, elo_after, strict=True), start=1)
        ]

    @classmethod
    async def get_ranking_history(
        cls,
        session: SessionDep,
        current_user: User,
        alliance_id: uuid.UUID,
    ) -> RankingHistoryResponse:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ALLIANCE_NOT_FOUND)
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, ALLIANCE_NOT_FOUND)

        display_season = await SeasonService.get_display_season(session)

        if display_season is None:
            return RankingHistoryResponse(season_number=None, season_status=None, points=[])

        wars = (
            await session.exec(
                select(War)
                .where(
                    War.alliance_id == alliance_id,
                    War.season_id == display_season.id,
                    War.status == WarStatus.ended,
                )
                .order_by(War.created_at)
            )
        ).all()

        points = cls._reconstruct_elo(list(wars), alliance.elo)
        return RankingHistoryResponse(
            season_number=display_season.number,
            season_status=display_season.status,
            points=points,
        )
