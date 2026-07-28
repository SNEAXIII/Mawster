import re
import uuid

from fastapi import HTTPException
from sqlalchemy import tuple_
from sqlmodel import select
from starlette import status

from src.models.Season import Season
from src.models.WarFightRecordImport import WarFightRecordImport
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import SessionDep


class FightRecordImportService:
    @staticmethod
    def _parse_season_number(season_name: str) -> int | None:
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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Cannot parse season name: '{season_name}'",
            )
        result = await session.exec(select(Season).where(Season.number == number))
        season = result.first()
        if season is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
    ) -> tuple[int, int]:
        account = await AllianceService.require_officer_account(
            session, alliance_id, current_user_id
        )
        officer_acc_id: uuid.UUID = account.id

        unique_names = {row.season_name for row in rows}
        season_map: dict[str, uuid.UUID] = {}
        for name in unique_names:
            season_map[name] = await cls.resolve_season(session, name)

        # Build (champion_id, defender_champion_id, node_number, season_id) tuples for all rows
        resolved = [
            (
                row.champion_id,
                row.defender_champion_id,
                row.node_number,
                season_map[row.season_name],
                row,
            )
            for row in rows
        ]

        # Fetch existing records matching any of these combinations in one query
        existing = (
            await session.exec(
                select(
                    WarFightRecordImport.champion_id,
                    WarFightRecordImport.defender_champion_id,
                    WarFightRecordImport.node_number,
                    WarFightRecordImport.season_id,
                ).where(
                    WarFightRecordImport.alliance_id == alliance_id,
                    tuple_(
                        WarFightRecordImport.champion_id,
                        WarFightRecordImport.defender_champion_id,
                        WarFightRecordImport.node_number,
                        WarFightRecordImport.season_id,
                    ).in_([(r[0], r[1], r[2], r[3]) for r in resolved]),
                )
            )
        ).all()
        existing_set = {(r[0], r[1], r[2], r[3]) for r in existing}

        imported = skipped = 0
        for champ_id, def_id, node, season_id, row in resolved:
            key = (champ_id, def_id, node, season_id)
            if key in existing_set:
                skipped += 1
                continue
            session.add(
                WarFightRecordImport(
                    alliance_id=alliance_id,
                    season_id=season_id,
                    node_number=node,
                    champion_id=champ_id,
                    defender_champion_id=def_id,
                    ko_count=row.ko_count,
                    imported_by_id=officer_acc_id,
                )
            )
            existing_set.add(key)
            imported += 1

        await session.commit()
        return imported, skipped
