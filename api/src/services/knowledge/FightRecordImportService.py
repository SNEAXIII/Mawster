import re
import uuid

from fastapi import HTTPException
from sqlalchemy import tuple_
from sqlmodel import select
from starlette import status

from src.models.war.Season import Season
from src.models.war.WarFightRecordImport import WarFightRecordImport
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
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"Cannot parse season name: '{season_name}'"
            )
        result = await session.exec(select(Season).where(Season.number == number))
        season = result.first()
        if season is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"Season not found: '{season_name}'"
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
        season_map = {
            name: await cls.resolve_season(session, name) for name in {r.season_name for r in rows}
        }
        # A fight is identified by who fought whom, where, and in which season.
        key_cols = (
            WarFightRecordImport.champion_id,
            WarFightRecordImport.defender_champion_id,
            WarFightRecordImport.node_number,
            WarFightRecordImport.season_id,
        )
        keys = [
            (r.champion_id, r.defender_champion_id, r.node_number, season_map[r.season_name])
            for r in rows
        ]
        existing = await session.exec(
            select(*key_cols).where(
                WarFightRecordImport.alliance_id == alliance_id, tuple_(*key_cols).in_(keys)
            )
        )
        seen = {tuple(r) for r in existing.all()}

        imported = skipped = 0
        for key, row in zip(keys, rows, strict=True):
            if key in seen:
                skipped += 1
                continue
            champion_id, defender_champion_id, node_number, season_id = key
            session.add(
                WarFightRecordImport(
                    alliance_id=alliance_id,
                    season_id=season_id,
                    node_number=node_number,
                    champion_id=champion_id,
                    defender_champion_id=defender_champion_id,
                    ko_count=row.ko_count,
                    imported_by_id=account.id,
                )
            )
            seen.add(key)
            imported += 1

        await session.commit()
        return imported, skipped
