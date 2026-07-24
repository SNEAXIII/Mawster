import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.dto.admin.dto_champion import (
    ChampionLoadRequest,
    ChampionPaginatedResponse,
    ChampionResponse,
    ChampionUpdateAliasRequest,
)
from src.Messages.champion_messages import (
    CHAMPION_ALIAS_UPDATED,
    CHAMPION_ASCENDABLE_UPDATED,
    CHAMPION_DELETED,
    CHAMPION_LOAD_SUCCESS,
    CHAMPION_PREFIGHT_UPDATED,
)
from src.services.admin.ChampionService import ChampionService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

# ── User-accessible read endpoints (/champions) ──────────
champion_read_controller = APIRouter(
    prefix="/champions",
    tags=["Champions"],
    dependencies=[
        Depends(AuthService.get_current_user_in_jwt),
    ],
)

# ── Admin-only write endpoints (/admin/champions) ────────
champion_controller = APIRouter(
    prefix="/admin/champions",
    tags=["Champions (Admin)"],
    dependencies=[
        Depends(AuthService.require_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@champion_read_controller.get("", status_code=200, response_model=ChampionPaginatedResponse)
async def get_champions(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1)] = 20,
    champion_class: str | None = None,
    search: str | None = None,
    is_ascendable: bool | None = None,
    has_prefight: bool | None = None,
):
    return await ChampionService.get_champions_with_pagination(
        session,
        page,
        size,
        champion_class,
        search,
        is_ascendable,
        has_prefight,
    )


@champion_read_controller.get("/{champion_id}", status_code=200, response_model=ChampionResponse)
async def get_champion(session: SessionDep, champion_id: uuid.UUID):
    champion = await ChampionService.get_champion_by_id(session, champion_id)
    return ChampionResponse.model_validate(champion)


@champion_controller.patch("/{champion_id}/alias", status_code=200)
async def update_champion_alias(
    session: SessionDep,
    champion_id: uuid.UUID,
    body: ChampionUpdateAliasRequest,
):
    await ChampionService.update_alias(session, champion_id, body.alias)
    return {"message": CHAMPION_ALIAS_UPDATED}


@champion_controller.patch("/{champion_id}/ascendable", status_code=200)
async def toggle_champion_ascendable(
    session: SessionDep,
    champion_id: uuid.UUID,
):
    champion = await ChampionService.toggle_ascendable(session, champion_id)
    return {"message": CHAMPION_ASCENDABLE_UPDATED, "is_ascendable": champion.is_ascendable}


@champion_controller.patch("/{champion_id}/prefight", status_code=200)
async def toggle_champion_prefight(
    session: SessionDep,
    champion_id: uuid.UUID,
):
    champion = await ChampionService.toggle_prefight(session, champion_id)
    return {"message": CHAMPION_PREFIGHT_UPDATED, "has_prefight": champion.has_prefight}


@champion_controller.post("/load", status_code=200)
async def load_champions(
    session: SessionDep,
    champions: list[ChampionLoadRequest],
):
    result = await ChampionService.load_champions(session, champions)
    return {
        "message": CHAMPION_LOAD_SUCCESS,
        "created": result["created"],
        "updated": result["updated"],
        "skipped": result["skipped"],
    }


@champion_controller.delete("/{champion_id}", status_code=200)
async def delete_champion(session: SessionDep, champion_id: uuid.UUID):
    await ChampionService.delete_champion(session, champion_id)
    return {"message": CHAMPION_DELETED}
