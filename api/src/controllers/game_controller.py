from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    GameAccountCreateRequest,
    GameAccountResponse,
    AllianceCreateRequest,
    AllianceResponse,
    ChampionUserCreateRequest,
    ChampionUserResponse,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.GameService import (
    GameAccountService,
    AllianceService,
    ChampionUserService,
)
from src.utils.db import SessionDep

game_controller = APIRouter(
    prefix="/game",
    tags=["Game"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


# ---- Game Account Endpoints ----


@game_controller.post(
    "/accounts",
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
    game_account = await GameAccountService.create_game_account(
        session=session,
        user_id=current_user.id,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )
    return game_account


@game_controller.get(
    "/accounts",
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


# ---- Alliance Endpoints ----


@game_controller.post(
    "/alliances",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_alliance(
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Create a new alliance. URL field will be added later (TODO)."""
    alliance = await AllianceService.create_alliance(
        session=session,
        name=body.name,
        tag=body.tag,
        description=body.description,
    )
    return alliance


# ---- Champion User Endpoints ----


@game_controller.post(
    "/champion-users",
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
    # Verify ownership
    game_account = await GameAccountService.get_game_account(
        session=session,
        game_account_id=body.game_account_id,
    )
    if game_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game account not found",
        )
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add champions to your own game accounts",
        )

    champion_user = await ChampionUserService.create_champion_user(
        session=session,
        game_account_id=body.game_account_id,
        champion_id=body.champion_id,
        stars=body.stars,
        rank=body.rank,
        level=body.level,
        signature=body.signature,
    )
    return champion_user
