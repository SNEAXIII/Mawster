import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status as http_status

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.models.Season import Season
from src.Messages.season_messages import (
    SEASON_CURRENT_EXISTS,
    SEASON_NOT_ENDED,
    SEASON_NOT_FOUND,
    SEASON_NUMBER_ALREADY_EXISTS,
)
from src.utils.db import SessionDep


class SeasonService:
    @classmethod
    async def get_current_season(cls, session: SessionDep) -> Season | None:
        """The single non-ended season (upcoming or active). Source of the war format."""
        result = await session.exec(select(Season).where(Season.status != SeasonStatus.ended))
        return result.first()

    @classmethod
    async def get_current_format(cls, session: SessionDep) -> SeasonFormat:
        season = await cls.get_current_season(session)
        return season.format if season is not None else SeasonFormat.regular

    @classmethod
    async def get_active_season(cls, session: SessionDep) -> Season | None:
        """The live season (status == active). Scope of stats / ranking."""
        result = await session.exec(select(Season).where(Season.status == SeasonStatus.active))
        return result.first()

    @classmethod
    async def get_all_seasons(cls, session: SessionDep) -> list[Season]:
        result = await session.exec(select(Season).order_by(Season.number.desc()))
        return list(result.all())

    @classmethod
    async def create_season(
        cls, session: SessionDep, number: int, format: SeasonFormat = SeasonFormat.regular
    ) -> Season:
        existing = await session.exec(select(Season).where(Season.number == number))
        if existing.first() is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=SEASON_NUMBER_ALREADY_EXISTS,
            )
        if await cls.get_current_season(session) is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=SEASON_CURRENT_EXISTS,
            )
        season = Season(number=number, format=format)
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def open_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        """Make a season live: upcoming | ended -> active. Recovers a mistaken close."""
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        current = await cls.get_current_season(session)
        if current is not None and current.id != season.id:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=SEASON_CURRENT_EXISTS,
            )
        season.status = SeasonStatus.active
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def revert_to_preseason(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        """Revert a closed season back to pre-season: ended -> upcoming. Recovers a mistaken close."""
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        if season.status != SeasonStatus.ended:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=SEASON_NOT_ENDED,
            )
        if await cls.get_current_season(session) is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=SEASON_CURRENT_EXISTS,
            )
        season.status = SeasonStatus.upcoming
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def close_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        """End a season: active -> ended."""
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        season.status = SeasonStatus.ended
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season
