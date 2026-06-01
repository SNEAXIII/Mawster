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

        from src.models.AllianceOfficer import AllianceOfficer
        from src.models.Alliance import Alliance

        acc_stmt = select(GameAccount).where(GameAccount.user_id == current_user_id)
        acc_result = await session.exec(acc_stmt)
        accounts = acc_result.all()

        officer_acc_id: Optional[uuid.UUID] = None
        for acc in accounts:
            officer_check = await session.exec(
                select(AllianceOfficer).where(
                    AllianceOfficer.alliance_id == alliance_id,
                    AllianceOfficer.game_account_id == acc.id,
                )
            )
            if officer_check.first():
                officer_acc_id = acc.id
                break

        # Fallback: check if user owns the alliance
        if officer_acc_id is None:
            alliance = await session.get(Alliance, alliance_id)
            if alliance:
                for acc in accounts:
                    if acc.id == alliance.owner_id:
                        officer_acc_id = acc.id
                        break

        # Final fallback: any account of this user
        if officer_acc_id is None and accounts:
            officer_acc_id = accounts[0].id

        if officer_acc_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No game account found for current user",
            )

        for row in rows:
            season_id = await cls.resolve_season(session, row.season_name)
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
