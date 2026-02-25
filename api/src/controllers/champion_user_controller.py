import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_champion_user import (
    ChampionUserCreateRequest,
    ChampionUserBulkRequest,
    ChampionUserResponse,
    ChampionUserDetailResponse,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.GameAccountService import GameAccountService
from src.services.ChampionUserService import ChampionUserService
from src.utils.db import SessionDep

champion_user_controller = APIRouter(
    prefix="/champion-users",
    tags=["Champion Users"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@champion_user_controller.post(
    "",
    response_model=ChampionUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_champion_user(
    body: ChampionUserCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add a champion to a game account's roster.
    The game account must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, body.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add champions to your own game accounts",
        )
    result = await ChampionUserService.create_champion_user(
        session=session,
        game_account_id=body.game_account_id,
        champion_id=body.champion_id,
        rarity=body.rarity,
        signature=body.signature,
    )
    return ChampionUserResponse.from_model(result)


@champion_user_controller.post(
    "/bulk",
    response_model=list[ChampionUserDetailResponse],
    status_code=status.HTTP_201_CREATED,
)
async def bulk_add_champions(
    body: ChampionUserBulkRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add multiple champions to a game account's roster at once.
    Deduplicates within the request (first occurrence wins).
    If a champion+rarity already exists, updates the signature."""
    game_account = await GameAccountService.get_game_account(session, body.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add champions to your own game accounts",
        )
    champions_data = [
        {
            "champion_name": entry.champion_name,
            "rarity": entry.rarity,
            "signature": entry.signature,
        }
        for entry in body.champions
    ]
    entries = await ChampionUserService.bulk_add_champions(
        session=session,
        game_account_id=body.game_account_id,
        champions=champions_data,
    )
    return [
        ChampionUserDetailResponse(
            id=e.id,
            game_account_id=e.game_account_id,
            champion_id=e.champion_id,
            rarity=e.rarity,
            signature=e.signature,
            champion_name=e.champion.name,
            champion_class=e.champion.champion_class,
            image_url=e.champion.image_url,
        )
        for e in entries
    ]


@champion_user_controller.get(
    "/by-account/{game_account_id}",
    response_model=list[ChampionUserDetailResponse],
)
async def get_roster_by_game_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all champions in a game account's roster with champion details.
    The game account must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own roster",
        )
    entries = await ChampionUserService.get_roster_by_game_account(session, game_account_id)
    return [
        ChampionUserDetailResponse(
            id=e.id,
            game_account_id=e.game_account_id,
            champion_id=e.champion_id,
            rarity=e.rarity,
            signature=e.signature,
            champion_name=e.champion.name,
            champion_class=e.champion.champion_class,
            image_url=e.champion.image_url,
        )
        for e in entries
    ]


@champion_user_controller.get(
    "/{champion_user_id}",
    response_model=ChampionUserResponse,
)
async def get_champion_user(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific champion user entry."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    # Verify ownership via game account
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    return ChampionUserResponse.from_model(champion_user)


@champion_user_controller.put(
    "/{champion_user_id}",
    response_model=ChampionUserResponse,
)
async def update_champion_user(
    champion_user_id: uuid.UUID,
    body: ChampionUserCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update a champion user entry (rarity, signature)."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    updated = await ChampionUserService.update_champion_user(
        session=session,
        champion_user=champion_user,
        rarity=body.rarity,
        signature=body.signature,
    )
    return ChampionUserResponse.from_model(updated)


@champion_user_controller.delete(
    "/{champion_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_champion_user(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete a champion from a roster."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    await ChampionUserService.delete_champion_user(session, champion_user)


@champion_user_controller.patch(
    "/{champion_user_id}/upgrade",
    response_model=ChampionUserResponse,
)
async def upgrade_champion_rank(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Upgrade a champion to the next rank (e.g. 7r2 → 7r3)."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    upgraded = await ChampionUserService.upgrade_champion_rank(session, champion_user)
    return ChampionUserResponse.from_model(upgraded)
