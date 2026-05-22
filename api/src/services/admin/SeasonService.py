from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.Season import Season
from src.Messages.season_messages import SEASON_NUMBER_ALREADY_EXISTS
from src.services.admin.AppConfigService import AppConfigService
from src.utils.db import SessionDep


class SeasonService:
    @classmethod
    async def get_active_season(cls, session: SessionDep) -> Season | None:
        season_id = await AppConfigService.get_current_season_id(session)
        if season_id is None:
            return None
        return await session.get(Season, season_id)

    @classmethod
    async def get_all_seasons(cls, session: SessionDep) -> list[Season]:
        result = await session.exec(select(Season).order_by(Season.number.desc()))
        return list(result.all())

    @classmethod
    async def create_season(
        cls, session: SessionDep, number: int, is_big_thing: bool = False
    ) -> Season:
        existing = await session.exec(select(Season).where(Season.number == number))
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=SEASON_NUMBER_ALREADY_EXISTS,
            )
        season = Season(number=number, is_big_thing=is_big_thing)
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season
