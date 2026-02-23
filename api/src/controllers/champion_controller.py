import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.dto.dto_game import (
    ChampionAdminViewAll,
    ChampionResponse,
    ChampionUpdateAliasRequest,
    ChampionLoadRequest,
)
from src.Messages.champion_messages import (
    CHAMPION_ALIAS_UPDATED,
    CHAMPION_DELETED,
    CHAMPION_LOAD_SUCCESS,
)
from src.services.AuthService import AuthService
from src.services.ChampionService import ChampionService
from src.utils.db import SessionDep

champion_controller = APIRouter(
    prefix="/admin/champions",
    tags=["Champions"],
    dependencies=[
        Depends(AuthService.is_logged_as_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@champion_controller.get("", status_code=200, response_model=ChampionAdminViewAll)
async def get_champions(
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1),
    champion_class: Optional[str] = None,
    search: Optional[str] = None,
):
    return await ChampionService.get_champions_with_pagination(
        session, page, size, champion_class, search
    )


@champion_controller.get("/{champion_id}", status_code=200, response_model=ChampionResponse)
async def get_champion(session: SessionDep, champion_id: uuid.UUID):
    champion = await ChampionService.get_champion_by_id(session, champion_id)
    return ChampionResponse(
        id=champion.id,
        name=champion.name,
        champion_class=champion.champion_class,
        image_url=champion.image_url,
        is_7_star=champion.is_7_star,
        alias=champion.alias,
    )


@champion_controller.patch("/{champion_id}/alias", status_code=200)
async def update_champion_alias(
    session: SessionDep,
    champion_id: uuid.UUID,
    body: ChampionUpdateAliasRequest,
):
    await ChampionService.update_alias(session, champion_id, body.alias)
    return {"message": CHAMPION_ALIAS_UPDATED}


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
