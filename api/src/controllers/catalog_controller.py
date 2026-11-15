from fastapi import APIRouter

from src.dto.dto_catalog import CatalogResponse, CatalogSeasonResponse
from src.services.admin.SeasonService import SeasonService
from src.services.CatalogService import CatalogService
from src.utils.db import SessionDep

catalog_controller = APIRouter(
    prefix="/catalog",
    tags=["Catalog"],
)


@catalog_controller.get("/champions", response_model=CatalogResponse)
async def get_champion_catalog(session: SessionDep, season_number: int | None = None):
    """The champion catalog, unauthenticated.

    Its own prefix rather than a `/champions/catalog` route: that path would collide
    with `/champions/{champion_id}` on the authenticated router, and which one wins
    depends on the order the routers are included.
    """
    return await CatalogService.get_public_catalog(session, season_number)


@catalog_controller.get("/seasons", response_model=list[CatalogSeasonResponse])
async def get_catalog_seasons(session: SessionDep):
    """The regular seasons, newest first, unauthenticated."""
    return await SeasonService.get_regular_seasons(session)
