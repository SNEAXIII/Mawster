import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.utils.db import SessionDep


class GameAccountService:
    @classmethod
    async def create_game_account(
        cls,
        session: SessionDep,
        user_id: uuid.UUID,
        game_pseudo: str,
        is_primary: bool = False,
    ) -> GameAccount:
        game_account = GameAccount(
            user_id=user_id,
            game_pseudo=game_pseudo,
            is_primary=is_primary,
        )
        session.add(game_account)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def get_game_accounts_by_user(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[GameAccount]:
        sql = select(GameAccount).where(GameAccount.user_id == user_id)
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_game_account(
        cls, session: SessionDep, game_account_id: int
    ) -> Optional[GameAccount]:
        return await session.get(GameAccount, game_account_id)


class AllianceService:
    @classmethod
    async def create_alliance(
        cls,
        session: SessionDep,
        name: str,
        tag: str,
        description: Optional[str] = None,
    ) -> Alliance:
        alliance = Alliance(
            name=name,
            tag=tag,
            description=description,
        )
        session.add(alliance)
        await session.commit()
        await session.refresh(alliance)
        return alliance

    @classmethod
    async def get_alliance(
        cls, session: SessionDep, alliance_id: int
    ) -> Optional[Alliance]:
        return await session.get(Alliance, alliance_id)


class ChampionUserService:
    @classmethod
    async def create_champion_user(
        cls,
        session: SessionDep,
        game_account_id: int,
        champion_id: int,
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
        cls, session: SessionDep, game_account_id: int
    ) -> list[ChampionUser]:
        sql = select(ChampionUser).where(
            ChampionUser.game_account_id == game_account_id
        )
        result = await session.exec(sql)
        return result.all()
