import re
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.GameAccount import GameAccount
from src.models.Season import Season
from src.models.WarFightRecordImport import WarFightRecordImport
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import SessionDep


class FightRecordImportService:
    @staticmethod
    def _parse_season_number(season_name: str) -> Optional[int]:
        cleaned = re.sub(r"^[Ss]", "", season_name.strip())
        try:
            return int(cleaned)
        except ValueError:
            return None

    @classmethod
    async def resolve_season(cls, session: SessionDep, season_name: str) -> uuid.UUID:
        number = cls._parse_season_number(season_name)
        if number is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot parse season name: '{season_name}'",
            )
        result = await session.exec(select(Season).where(Season.number == number))
        season = result.first()
        if season is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Season not found: '{season_name}'",
            )
        return season.id

    @classmethod
    async def import_records(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        current_user_id: uuid.UUID,
        rows: list,
    ) -> int:
        await AllianceService.require_officer(session, alliance_id, current_user_id)

        acc_result = await session.exec(
            select(GameAccount).where(
                GameAccount.user_id == current_user_id,
                GameAccount.alliance_id == alliance_id,
            )
        )
        account = acc_result.first()

        if account is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No game account found for current user in this alliance",
            )

        officer_acc_id: uuid.UUID = account.id

        unique_names = {row.season_name for row in rows}
        season_map: dict[str, uuid.UUID] = {}
        for name in unique_names:
            season_map[name] = await cls.resolve_season(session, name)

        for row in rows:
            season_id = season_map[row.season_name]
            record = WarFightRecordImport(
                alliance_id=alliance_id,
                season_id=season_id,
                node_number=row.node_number,
                champion_id=row.champion_id,
                defender_champion_id=row.defender_champion_id,
                ko_count=row.ko_count,
                imported_by_id=officer_acc_id,
            )
            session.add(record)

        await session.commit()
        return len(rows)
