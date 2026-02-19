from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    ChampionUserCreateRequest,
    ChampionUserResponse,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.GameService import GameAccountService, ChampionUserService
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
    return await ChampionUserService.create_champion_user(
        session=session,
        game_account_id=body.game_account_id,
        champion_id=body.champion_id,
        stars=body.stars,
        rank=body.rank,
        level=body.level,
        signature=body.signature,
    )


@champion_user_controller.get(
    "/by-account/{game_account_id}",
    response_model=list[ChampionUserResponse],
)
async def get_roster_by_game_account(
    game_account_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all champions in a game account's roster.
    The game account must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own roster",
        )
    return await ChampionUserService.get_roster_by_game_account(session, game_account_id)


@champion_user_controller.get(
    "/{champion_user_id}",
    response_model=ChampionUserResponse,
)
async def get_champion_user(
    champion_user_id: int,
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
    return champion_user


@champion_user_controller.put(
    "/{champion_user_id}",
    response_model=ChampionUserResponse,
)
async def update_champion_user(
    champion_user_id: int,
    body: ChampionUserCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update a champion user entry (stars, rank, level, signature)."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    return await ChampionUserService.update_champion_user(
        session=session,
        champion_user=champion_user,
        stars=body.stars,
        rank=body.rank,
        level=body.level,
        signature=body.signature,
    )


@champion_user_controller.delete(
    "/{champion_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_champion_user(
    champion_user_id: int,
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
