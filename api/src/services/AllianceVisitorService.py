import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.AllianceVisitor import AllianceVisitor
from src.Messages.visitor_messages import (
    ALREADY_A_VISITOR,
    NOT_A_VISITOR,
)
from src.utils.db import SessionDep

MAX_VISITORS_PER_ALLIANCE = 10


class AllianceVisitorService:
    @staticmethod
    async def count_visitors(session: SessionDep, alliance_id: uuid.UUID) -> int:
        result = await session.exec(
            select(func.count(AllianceVisitor.id)).where(
                AllianceVisitor.alliance_id == alliance_id
            )
        )
        return result.one()

    @staticmethod
    async def find_visitor(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> Optional[AllianceVisitor]:
        result = await session.exec(
            select(AllianceVisitor).where(
                AllianceVisitor.alliance_id == alliance_id,
                AllianceVisitor.game_account_id == game_account_id,
            )
        )
        return result.first()

    @staticmethod
    async def is_visitor(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> bool:
        result = await session.exec(
            select(AllianceVisitor).where(
                AllianceVisitor.alliance_id == alliance_id,
                AllianceVisitor.game_account_id == game_account_id,
            )
        )
        return result.first() is not None

    @classmethod
    async def create_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> AllianceVisitor:
        existing = await cls.find_visitor(session, alliance_id, game_account_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ALREADY_A_VISITOR,
            )
        visitor = AllianceVisitor(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
        )
        session.add(visitor)
        await session.commit()
        await session.refresh(visitor)
        return visitor

    @classmethod
    async def remove_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> None:
        visitor = await cls.find_visitor(session, alliance_id, game_account_id)
        if visitor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=NOT_A_VISITOR,
            )
        await session.delete(visitor)
        await session.commit()

    @classmethod
    async def remove_if_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> None:
        """Remove visitor record if it exists. No error if not a visitor."""
        visitor = await cls.find_visitor(session, alliance_id, game_account_id)
        if visitor is not None:
            await session.delete(visitor)

    @classmethod
    async def get_visitors(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> list[AllianceVisitor]:
        result = await session.exec(
            select(AllianceVisitor)
            .where(AllianceVisitor.alliance_id == alliance_id)
            .options(selectinload(AllianceVisitor.game_account))  # type: ignore[arg-type]
        )
        return result.all()

    @classmethod
    async def get_visited_alliances(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[AllianceVisitor]:
        """Return all active visits for game accounts belonging to this user."""
        from src.models.GameAccount import GameAccount

        accs = await session.exec(select(GameAccount).where(GameAccount.user_id == user_id))
        account_ids = {acc.id for acc in accs.all()}
        if not account_ids:
            return []
        result = await session.exec(
            select(AllianceVisitor)
            .where(AllianceVisitor.game_account_id.in_(account_ids))  # type: ignore[union-attr]
            .options(selectinload(AllianceVisitor.alliance))  # type: ignore[arg-type]
        )
        return result.all()
