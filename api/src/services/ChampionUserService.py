import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.GameAccount import GameAccount
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.utils.db import SessionDep


class ChampionUserService:
    @classmethod
    async def create_champion_user(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
        stars: int = 0,
        rank: int = 1,
        level: int = 1,
        signature: int = 0,
    ) -> ChampionUser:
        # Verify the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )

        # Verify the champion exists
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Champion not found",
            )

        champion_user = ChampionUser(
            game_account_id=game_account_id,
            champion_id=champion_id,
            stars=stars,
            rank=rank,
            level=level,
            signature=signature,
        )
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def get_roster_by_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[ChampionUser]:
        sql = select(ChampionUser).where(
            ChampionUser.game_account_id == game_account_id
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_champion_user(
        cls, session: SessionDep, champion_user_id: uuid.UUID
    ) -> Optional[ChampionUser]:
        return await session.get(ChampionUser, champion_user_id)

    @classmethod
    async def update_champion_user(
        cls,
        session: SessionDep,
        champion_user: ChampionUser,
        stars: int,
        rank: int,
        level: int,
        signature: int,
    ) -> ChampionUser:
        champion_user.stars = stars
        champion_user.rank = rank
        champion_user.level = level
        champion_user.signature = signature
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def delete_champion_user(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> None:
        await session.delete(champion_user)
        await session.commit()
