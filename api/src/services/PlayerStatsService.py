import uuid

from fastapi import HTTPException
from starlette import status
from sqlmodel import select

from src.models.User import User
from src.models.GameAccount import GameAccount
from src.models.ChampionUser import ChampionUser
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.Season import Season
from src.dto.player.dto_player_stats import PlayerSeasonOption
from src.utils.db import SessionDep


class PlayerStatsService:
    @classmethod
    async def assert_can_view_account(
        cls, session: SessionDep, current_user: User, game_account_id: uuid.UUID
    ) -> GameAccount:
        """Today: only the owner may view. Future officer view extends here only."""
        account = await session.get(GameAccount, game_account_id)
        if account is None or account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found"
            )
        return account

    @classmethod
    async def get_player_seasons(
        cls, session: SessionDep, current_user: User, game_account_id: uuid.UUID
    ) -> list[PlayerSeasonOption]:
        await cls.assert_can_view_account(session, current_user, game_account_id)
        stmt = (
            select(Season.id, Season.number, Season.status)
            .join(War, War.season_id == Season.id)
            .join(WarDefensePlacement, WarDefensePlacement.war_id == War.id)
            .join(
                ChampionUser,
                ChampionUser.id == WarDefensePlacement.attacker_champion_user_id,
            )
            .where(ChampionUser.game_account_id == game_account_id)
            .where(War.status == WarStatus.ended)
            .group_by(Season.id, Season.number, Season.status)
            .order_by(Season.number.desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [
            PlayerSeasonOption(season_id=r["id"], number=r["number"], status=str(r["status"].value))
            for r in rows
        ]
