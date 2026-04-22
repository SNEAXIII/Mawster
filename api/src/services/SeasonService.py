import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.Season import Season
from src.Messages.season_messages import SEASON_NOT_FOUND, SEASON_NUMBER_ALREADY_EXISTS
from src.utils.db import SessionDep


class SeasonService:
    @classmethod
    async def get_active_season(cls, session: SessionDep) -> Season | None:
        result = await session.exec(select(Season).where(Season.is_active))
        return result.first()

    @classmethod
    async def get_all_seasons(cls, session: SessionDep) -> list[Season]:
        result = await session.exec(select(Season).order_by(Season.number.desc()))
        return list(result.all())

    @classmethod
    async def create_season(cls, session: SessionDep, number: int) -> Season:
        existing = await session.exec(select(Season).where(Season.number == number))
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=SEASON_NUMBER_ALREADY_EXISTS,
            )
        season = Season(number=number)
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def activate_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        # Deactivate all active seasons before activating the new one
        active_seasons = await session.exec(select(Season).where(Season.is_active))
        for s in active_seasons.all():
            s.is_active = False
            session.add(s)
        season.is_active = True
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def deactivate_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        season.is_active = False
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season
