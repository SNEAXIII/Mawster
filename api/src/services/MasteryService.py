import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.Mastery import Mastery
from src.models.GameAccountMastery import GameAccountMastery
from src.Messages.mastery_messages import (
    MASTERY_NOT_FOUND,
    MASTERY_VALUE_EXCEEDS_MAX,
    MASTERY_ATTACK_EXCEEDS_UNLOCKED,
    MASTERY_DEFENSE_EXCEEDS_UNLOCKED,
)
from src.dto.dto_mastery import GameAccountMasteryUpsertItem
from src.utils.db import SessionDep


class MasteryService:

    # ─── Admin ───────────────────────────────────────────────────

    @classmethod
    async def get_all(cls, session: SessionDep) -> list[Mastery]:
        result = await session.exec(select(Mastery).order_by(Mastery.order))
        return list(result.all())

    @classmethod
    async def create(cls, session: SessionDep, name: str, max_value: int, order: int) -> Mastery:
        mastery = Mastery(name=name, max_value=max_value, order=order)
        session.add(mastery)
        await session.commit()
        await session.refresh(mastery)
        return mastery

    @classmethod
    async def update(cls, session: SessionDep, mastery_id: uuid.UUID, name: str, order: int) -> Mastery:
        mastery = await session.get(Mastery, mastery_id)
        if mastery is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MASTERY_NOT_FOUND)
        mastery.name = name
        mastery.order = order
        session.add(mastery)
        await session.commit()
        await session.refresh(mastery)
        return mastery

    @classmethod
    async def delete(cls, session: SessionDep, mastery_id: uuid.UUID) -> None:
        mastery = await session.get(Mastery, mastery_id)
        if mastery is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MASTERY_NOT_FOUND)
        # Delete associated GameAccountMastery rows first to avoid FK violation
        gam_result = await session.exec(
            select(GameAccountMastery).where(GameAccountMastery.mastery_id == mastery_id)
        )
        for row in gam_result.all():
            await session.delete(row)
        await session.delete(mastery)
        await session.commit()

    # ─── Game account ─────────────────────────────────────────────

    @classmethod
    async def get_for_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[GameAccountMastery]:
        result = await session.exec(
            select(GameAccountMastery).where(
                GameAccountMastery.game_account_id == game_account_id
            )
        )
        return list(result.all())

    @classmethod
    async def upsert_for_account(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        items: list[GameAccountMasteryUpsertItem],
    ) -> list[GameAccountMastery]:
        for item in items:
            mastery = await session.get(Mastery, item.mastery_id)
            if mastery is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MASTERY_NOT_FOUND)
            if item.unlocked > mastery.max_value:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=MASTERY_VALUE_EXCEEDS_MAX,
                )
            if item.attack > item.unlocked:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=MASTERY_ATTACK_EXCEEDS_UNLOCKED,
                )
            if item.defense > item.unlocked:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=MASTERY_DEFENSE_EXCEEDS_UNLOCKED,
                )

            existing = await session.exec(
                select(GameAccountMastery).where(
                    GameAccountMastery.game_account_id == game_account_id,
                    GameAccountMastery.mastery_id == item.mastery_id,
                )
            )
            row = existing.first()
            if row:
                row.unlocked = item.unlocked
                row.attack = item.attack
                row.defense = item.defense
            else:
                row = GameAccountMastery(
                    game_account_id=game_account_id,
                    mastery_id=item.mastery_id,
                    unlocked=item.unlocked,
                    attack=item.attack,
                    defense=item.defense,
                )
            session.add(row)

        await session.commit()
        return await cls.get_for_account(session, game_account_id)
