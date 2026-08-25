import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select
from starlette import status

from src.Messages.game_account_messages import (
    GAME_ACCOUNT_ALREADY_DELETED,
    GAME_ACCOUNT_IN_ALLIANCE,
    GAME_ACCOUNT_IS_ALLIANCE_OWNER,
    GAME_ACCOUNT_NOT_DELETED,
    GAME_ACCOUNT_RESTORE_EXPIRED,
    max_game_accounts_reached,
)
from src.models.alliance.Alliance import Alliance
from src.models.Base import as_utc, utcnow
from src.models.user.GameAccount import GameAccount
from src.utils.db import SessionDep

MAX_GAME_ACCOUNTS_PER_USER = 10
# A deleted game account is only logically deleted: its owner can bring it back
# for this many days. Past that window it is unreachable — the rows stay in DB
# for history, but no endpoint ever hands them back.
RESTORE_WINDOW_DAYS = 7


class GameAccountService:
    # ---- Soft-delete helpers ----

    @staticmethod
    def restorable_until(game_account: GameAccount) -> datetime | None:
        """Deadline past which a deleted account can no longer be restored."""
        if game_account.deleted_at is None:
            return None
        return as_utc(game_account.deleted_at) + timedelta(days=RESTORE_WINDOW_DAYS)

    @classmethod
    def is_restorable(cls, game_account: GameAccount) -> bool:
        deadline = cls.restorable_until(game_account)
        return deadline is not None and deadline > utcnow()

    @staticmethod
    def _restore_cutoff() -> datetime:
        """Accounts deleted before this instant are definitively lost."""
        return utcnow() - timedelta(days=RESTORE_WINDOW_DAYS)

    @classmethod
    async def _ensure_single_primary(
        cls, session: SessionDep, user_id: uuid.UUID, primary_id: uuid.UUID
    ) -> None:
        """Unset is_primary on all other accounts for this user."""
        result = await session.exec(
            select(GameAccount).where(
                GameAccount.user_id == user_id,
                GameAccount.id != primary_id,
                GameAccount.is_primary.is_(True),
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
        # Enforce max accounts limit. A deleted account still holds its slot as
        # long as it can be restored — freeing it would let the user overshoot
        # the quota by restoring afterwards.
        existing = await session.exec(
            select(GameAccount).where(
                GameAccount.user_id == user_id,
                or_(
                    GameAccount.deleted_at.is_(None),
                    GameAccount.deleted_at > cls._restore_cutoff(),
                ),
            )
        )
        existing_accounts = existing.all()
        if len(existing_accounts) >= MAX_GAME_ACCOUNTS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=max_game_accounts_reached(MAX_GAME_ACCOUNTS_PER_USER),
            )
        # First *live* account is always primary — a deleted one cannot be it.
        if not any(acc.deleted_at is None for acc in existing_accounts):
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
        """Live game accounts of a user, sorted by primary first."""
        sql = select(GameAccount).where(
            GameAccount.user_id == user_id,
            GameAccount.deleted_at.is_(None),
        )
        if load_alliance:
            sql = sql.options(selectinload(GameAccount.alliance))  # type: ignore[arg-type]
        sql = sql.order_by(GameAccount.is_primary.desc())  # type: ignore[union-attr]
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_restorable_game_accounts(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[GameAccount]:
        """Deleted accounts of a user that are still within the restore window."""
        sql = (
            select(GameAccount)
            .where(
                GameAccount.user_id == user_id,
                GameAccount.deleted_at.is_not(None),
                GameAccount.deleted_at > cls._restore_cutoff(),
            )
            .order_by(GameAccount.deleted_at.desc())  # type: ignore[union-attr]
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID, include_deleted: bool = False
    ) -> GameAccount | None:
        """Load a game account. Deleted accounts read as missing unless asked for."""
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            return None
        if game_account.deleted_at is not None and not include_deleted:
            return None
        return game_account

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
    async def _promote_next_primary(cls, session: SessionDep, user_id: uuid.UUID) -> None:
        """Give the primary flag to the oldest live account, if any is left."""
        result = await session.exec(
            select(GameAccount)
            .where(
                GameAccount.user_id == user_id,
                GameAccount.deleted_at.is_(None),
            )
            .order_by(GameAccount.created_at)  # type: ignore[arg-type]
        )
        accounts = result.all()
        if not accounts or any(acc.is_primary for acc in accounts):
            return
        accounts[0].is_primary = True
        session.add(accounts[0])

    @classmethod
    async def delete_game_account(cls, session: SessionDep, game_account: GameAccount) -> None:
        """Logically delete a game account. It must not belong to any alliance."""
        if game_account.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GAME_ACCOUNT_ALREADY_DELETED,
            )
        owned = await session.exec(select(Alliance).where(Alliance.owner_id == game_account.id))
        if owned.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GAME_ACCOUNT_IS_ALLIANCE_OWNER,
            )
        if game_account.alliance_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GAME_ACCOUNT_IN_ALLIANCE,
            )
        game_account.deleted_at = utcnow()
        # The primary flag belongs to a live account: hand it over before leaving.
        game_account.is_primary = False
        session.add(game_account)
        await session.flush()
        await cls._promote_next_primary(session, game_account.user_id)
        await session.commit()

    @classmethod
    async def restore_game_account(
        cls, session: SessionDep, game_account: GameAccount
    ) -> GameAccount:
        """Bring a deleted account back, as long as the restore window is open."""
        if game_account.deleted_at is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GAME_ACCOUNT_NOT_DELETED,
            )
        if not cls.is_restorable(game_account):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=GAME_ACCOUNT_RESTORE_EXPIRED,
            )
        # No quota check: the account never gave its slot back while deleted.
        game_account.deleted_at = None
        session.add(game_account)
        await session.flush()
        # If every other account is gone, the restored one takes the primary flag.
        await cls._promote_next_primary(session, game_account.user_id)
        await session.commit()
        await session.refresh(game_account)
        return game_account
