import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_champion import (
    ChampionPaginatedResponse,
    ChampionResponse,
    ChampionUpdateAliasRequest,
    ChampionLoadRequest,
)
from src.Messages.champion_messages import (
    CHAMPION_ALIAS_UPDATED,
    CHAMPION_ASCENDABLE_UPDATED,
    CHAMPION_PREFIGHT_UPDATED,
    CHAMPION_SAGA_ATTACKER_UPDATED,
    CHAMPION_SAGA_DEFENDER_UPDATED,
    CHAMPION_DELETED,
    CHAMPION_LOAD_SUCCESS,
)
from src.services.AuthService import AuthService
from src.services.ChampionService import ChampionService
from src.utils.db import SessionDep

# ── User-accessible read endpoints (/champions) ──────────
champion_read_controller = APIRouter(
    prefix="/champions",
    tags=["Champions"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)

# ── Admin-only write endpoints (/admin/champions) ────────
champion_controller = APIRouter(
    prefix="/admin/champions",
    tags=["Champions (Admin)"],
    dependencies=[
        Depends(AuthService.is_logged_as_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@champion_read_controller.get("", status_code=200, response_model=ChampionPaginatedResponse)
async def get_champions(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1)] = 20,
    champion_class: Optional[str] = None,
    search: Optional[str] = None,
):
    return await ChampionService.get_champions_with_pagination(
        session, page, size, champion_class, search
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


@champion_controller.patch("/{champion_id}/saga-attacker", status_code=200)
async def toggle_champion_saga_attacker(
    session: SessionDep,
    champion_id: uuid.UUID,
):
    champion = await ChampionService.toggle_saga_attacker(session, champion_id)
    return {
        "message": CHAMPION_SAGA_ATTACKER_UPDATED,
        "is_saga_attacker": champion.is_saga_attacker,
    }


@champion_controller.patch("/{champion_id}/saga-defender", status_code=200)
async def toggle_champion_saga_defender(
    session: SessionDep,
    champion_id: uuid.UUID,
):
    champion = await ChampionService.toggle_saga_defender(session, champion_id)
    return {
        "message": CHAMPION_SAGA_DEFENDER_UPDATED,
        "is_saga_defender": champion.is_saga_defender,
    }


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
