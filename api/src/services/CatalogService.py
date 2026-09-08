from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.admin.dto_champion import ChampionResponse
from src.dto.dto_catalog import CatalogChampionResponse, CatalogResponse
from src.models import Champion
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService


class CatalogService:
    """The champion catalog as it is served to anyone, signed in or not."""

    @staticmethod
    async def get_public_catalog(session: AsyncSession) -> CatalogResponse:
        """Every champion, with the saga roles of the season currently running.

        No season running means no saga role: the flags come back false rather than
        carrying over the last season's, which would read as current and be wrong.
        """
        season = await SeasonService.get_current_season(session)
        saga_roles = (
            await SagaService.get_roles_for_season(session, season.id) if season is not None else {}
        )
        champions = (await session.exec(select(Champion).order_by(Champion.name))).all()
        return CatalogResponse(
            season_number=season.number if season is not None else None,
            champions=[
                CatalogChampionResponse(
                    # Through the shared champion shape rather than field by field, so a
                    # column added there reaches the catalog without a second edit.
                    **ChampionResponse.model_validate(champion).model_dump(),
                    is_saga_attacker=saga_roles.get(champion.id, (False, False))[0],
                    is_saga_defender=saga_roles.get(champion.id, (False, False))[1],
                )
                for champion in champions
            ],
        )
