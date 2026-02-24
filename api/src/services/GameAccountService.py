import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.GameAccount import GameAccount
from src.utils.db import SessionDep

MAX_GAME_ACCOUNTS_PER_USER = 10


class GameAccountService:
    @classmethod
    async def create_game_account(
        cls,
        session: SessionDep,
        user_id: uuid.UUID,
        game_pseudo: str,
        is_primary: bool = False,
    ) -> GameAccount:
        # Enforce max accounts limit
        existing = await session.exec(
            select(GameAccount).where(GameAccount.user_id == user_id)
        )
        if len(existing.all()) >= MAX_GAME_ACCOUNTS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_GAME_ACCOUNTS_PER_USER} game accounts allowed per user",
            )
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
        sql = (
            select(GameAccount)
            .where(GameAccount.user_id == user_id)
            .options(selectinload(GameAccount.alliance))  # type: ignore[arg-type]
            .order_by(GameAccount.is_primary.desc())  # type: ignore[union-attr]
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> Optional[GameAccount]:
        return await session.get(GameAccount, game_account_id)

    @classmethod
    async def update_game_account(
        cls,
        session: SessionDep,
        game_account: GameAccount,
        game_pseudo: str,
        is_primary: bool,
    ) -> GameAccount:
        game_account.game_pseudo = game_pseudo
        game_account.is_primary = is_primary
        session.add(game_account)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def delete_game_account(
        cls, session: SessionDep, game_account: GameAccount
    ) -> None:
        await session.delete(game_account)
        await session.commit()
