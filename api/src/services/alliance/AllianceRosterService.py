import uuid

from sqlmodel import select
from sqlalchemy.orm import selectinload

from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.utils.db import SessionDep


class AllianceRosterService:
    @classmethod
    async def get_alliance_roster(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> list[ChampionUser]:
        """Return every champion entry owned by any game account in the alliance."""
        sql = (
            select(ChampionUser)
            .join(GameAccount, ChampionUser.game_account_id == GameAccount.id)
            .where(GameAccount.alliance_id == alliance_id)
            .options(
                selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
            )
            .order_by(ChampionUser.champion_id)
        )
        result = await session.exec(sql)
        return result.all()
