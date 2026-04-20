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
from src.dto.dto_mastery import GameAccountMasteryUpsertItem, GameAccountMasteryResponse
from src.utils.db import SessionDep


class MasteryService:

    # ─── Game account ─────────────────────────────────────────────

    @classmethod
    async def get_for_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[GameAccountMasteryResponse]:
        all_masteries = list((await session.exec(select(Mastery))).all())
        saved_rows = list(
            (await session.exec(
                select(GameAccountMastery).where(
                    GameAccountMastery.game_account_id == game_account_id
                )
            )).all()
        )
        saved_map = {row.mastery_id: row for row in saved_rows}
        result = []
        for mastery in sorted(all_masteries, key=lambda m: m.order):
            row = saved_map.get(mastery.id)
            result.append(GameAccountMasteryResponse(
                id=row.id if row else None,
                mastery_id=mastery.id,
                mastery_name=mastery.name,
                mastery_max_value=mastery.max_value,
                mastery_order=mastery.order,
                unlocked=row.unlocked if row else 0,
                attack=row.attack if row else 0,
                defense=row.defense if row else 0,
            ))
        return result

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
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=MASTERY_VALUE_EXCEEDS_MAX,
                )
            if item.attack > item.unlocked:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=MASTERY_ATTACK_EXCEEDS_UNLOCKED,
                )
            if item.defense > item.unlocked:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
