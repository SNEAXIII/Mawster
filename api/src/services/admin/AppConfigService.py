import uuid
from typing import Optional

from src.models.AppConfig import AppConfig
from src.utils.db import SessionDep


class AppConfigService:
    CURRENT_SEASON_ID_KEY = "current_season_id"
    OFF_SEASON_BIG_THING_KEY = "off_season_big_thing"

    @classmethod
    async def _get(cls, session: SessionDep, key: str) -> Optional[AppConfig]:
        return await session.get(AppConfig, key)

    @classmethod
    async def _set(cls, session: SessionDep, key: str, value: str) -> None:
        entry = await session.get(AppConfig, key)
        if entry is None:
            entry = AppConfig(key=key, value=value)
        else:
            entry.value = value
        session.add(entry)
        await session.commit()

    @classmethod
    async def get_current_season_id(cls, session: SessionDep) -> Optional[uuid.UUID]:
        entry = await cls._get(session, cls.CURRENT_SEASON_ID_KEY)
        if entry is None or entry.value == "null":
            return None
        return uuid.UUID(entry.value)

    @classmethod
    async def set_current_season_id(
        cls, session: SessionDep, season_id: Optional[uuid.UUID]
    ) -> None:
        await cls._set(session, cls.CURRENT_SEASON_ID_KEY, str(season_id) if season_id else "null")

    @classmethod
    async def get_off_season_big_thing(cls, session: SessionDep) -> bool:
        entry = await cls._get(session, cls.OFF_SEASON_BIG_THING_KEY)
        return entry is not None and entry.value == "true"

    @classmethod
    async def set_off_season_big_thing(cls, session: SessionDep, value: bool) -> None:
        await cls._set(session, cls.OFF_SEASON_BIG_THING_KEY, "true" if value else "false")
