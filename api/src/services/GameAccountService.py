import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload
from starlette import status

from src.Messages.game_account_messages import max_game_accounts_reached
from src.models.GameAccount import GameAccount
from src.utils.db import SessionDep

MAX_GAME_ACCOUNTS_PER_USER = 10


class GameAccountService:
    @classmethod
    async def _ensure_single_primary(
        cls, session: SessionDep, user_id: uuid.UUID, primary_id: uuid.UUID
    ) -> None:
        """Unset is_primary on all other accounts for this user."""
        result = await session.exec(
            select(GameAccount).where(
                GameAccount.user_id == user_id,
                GameAccount.id != primary_id,
                GameAccount.is_primary == True,  # noqa: E712
            )
        )
        for acc in result.all():
            acc.is_primary = False
            session.add(acc)

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
        existing_accounts = existing.all()
        if len(existing_accounts) >= MAX_GAME_ACCOUNTS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=max_game_accounts_reached(MAX_GAME_ACCOUNTS_PER_USER),
            )
        # First account is always primary
        if len(existing_accounts) == 0:
            is_primary = True
        game_account = GameAccount(
            user_id=user_id,
            game_pseudo=game_pseudo,
            is_primary=is_primary,
        )
        session.add(game_account)
        # Enforce single primary
        if is_primary:
            await session.flush()
            await cls._ensure_single_primary(session, user_id, game_account.id)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def get_game_accounts_by_user(
        cls, session: SessionDep, user_id: uuid.UUID, load_alliance: bool = False
    ) -> list[GameAccount]:
        sql = select(GameAccount).where(GameAccount.user_id == user_id)
        if load_alliance:
            sql = sql.options(selectinload(GameAccount.alliance))  # type: ignore[arg-type]
        sql = sql.order_by(GameAccount.is_primary.desc())  # type: ignore[union-attr]
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
        # Enforce single primary
        if is_primary:
            await cls._ensure_single_primary(session, game_account.user_id, game_account.id)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def delete_game_account(
        cls, session: SessionDep, game_account: GameAccount
    ) -> None:
        await session.delete(game_account)
        await session.commit()
