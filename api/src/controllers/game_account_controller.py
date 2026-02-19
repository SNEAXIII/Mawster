from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    GameAccountCreateRequest,
    GameAccountResponse,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.GameService import GameAccountService
from src.utils.db import SessionDep

game_account_controller = APIRouter(
    prefix="/game-accounts",
    tags=["Game Accounts"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@game_account_controller.post(
    "",
    response_model=GameAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_game_account(
    body: GameAccountCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Create a new game account for the current user.
    Only a game pseudo is required. The ID is auto-generated."""
    return await GameAccountService.create_game_account(
        session=session,
        user_id=current_user.id,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )


@game_account_controller.get(
    "",
    response_model=list[GameAccountResponse],
)
async def get_my_game_accounts(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all game accounts for the current user."""
    return await GameAccountService.get_game_accounts_by_user(
        session=session,
        user_id=current_user.id,
    )


@game_account_controller.get(
    "/{game_account_id}",
    response_model=GameAccountResponse,
)
async def get_game_account(
    game_account_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific game account by ID. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your game account")
    return game_account


@game_account_controller.put(
    "/{game_account_id}",
    response_model=GameAccountResponse,
)
async def update_game_account(
    game_account_id: int,
    body: GameAccountCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update a game account. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your game account")
    return await GameAccountService.update_game_account(
        session=session,
        game_account=game_account,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )


@game_account_controller.delete(
    "/{game_account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_game_account(
    game_account_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete a game account. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your game account")
    await GameAccountService.delete_game_account(session, game_account)
