from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.enums.SeasonStatus import SeasonStatus
from src.models.Season import Season


class SeasonService:
    @staticmethod
    async def get_display_season(session: AsyncSession) -> Season | None:
        """Season to display in stats: the active one, else the latest ended."""
        active = (
            await session.exec(select(Season).where(Season.status == SeasonStatus.active))
        ).first()
        if active is not None:
            return active
        return (
            await session.exec(
                select(Season)
                .where(Season.status == SeasonStatus.ended)
                .order_by(Season.number.desc())
            )
        ).first()
