import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.account.game.dto_champion_user import (
    ChampionUserBulkRequest,
    ChampionUserCreateRequest,
    ChampionUserDetailResponse,
    ChampionUserResponse,
)
from src.Messages.champion_user_messages import CHAMPION_USER_NOT_FOUND, NOT_YOUR_CHAMPION
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.models import User
from src.models.ChampionUser import ChampionUser
from src.services.auth.AuthService import AuthService
from src.services.alliance.AllianceService import AllianceService
from src.services.account.game.ChampionUserService import ChampionUserService
from src.services.account.game.GameAccountService import GameAccountService
from src.utils.db import SessionDep

champion_user_controller = APIRouter(
    prefix="/champion-users",
    tags=["Champion Users"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


async def _get_own_champion_user(
    session: SessionDep,
    champion_user_id: uuid.UUID,
    current_user_id: uuid.UUID,
) -> "ChampionUser":
    """Load a champion user and verify it belongs to the current user. Raises 404/403."""
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_USER_NOT_FOUND)
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_CHAMPION)
    return champion_user


@champion_user_controller.post(
    "", response_model=ChampionUserResponse, status_code=status.HTTP_201_CREATED
)
async def create_champion_user(
    body: ChampionUserCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add a champion to a game account's roster. The game account must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, body.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
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
        is_preferred_attacker=body.is_preferred_attacker,
        ascension=body.ascension,
    )
    return ChampionUserResponse.model_validate(result)


@champion_user_controller.post(
    "/bulk", response_model=list[ChampionUserDetailResponse], status_code=status.HTTP_201_CREATED
)
async def bulk_add_champions(
    body: ChampionUserBulkRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add multiple champions to a game account's roster at once."""
    game_account = await GameAccountService.get_game_account(session, body.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
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
            "is_preferred_attacker": entry.is_preferred_attacker,
            "ascension": entry.ascension,
        }
        for entry in body.champions
    ]
    entries = await ChampionUserService.bulk_add_champions(
        session=session, game_account_id=body.game_account_id, champions=champions_data
    )
    return [ChampionUserDetailResponse.model_validate(e) for e in entries]


@champion_user_controller.get(
    "/by-account/{game_account_id}", response_model=list[ChampionUserDetailResponse]
)
async def get_roster_by_game_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all champions in a game account's roster. Must be own account or alliance member."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        if not await AllianceService.can_view_roster(session, current_user.id, game_account):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own roster or rosters of alliance members",
            )
    entries = await ChampionUserService.get_roster_by_game_account(session, game_account_id)
    return [ChampionUserDetailResponse.model_validate(e) for e in entries]


@champion_user_controller.patch(
    "/{champion_user_id}/preferred-attacker", response_model=ChampionUserResponse
)
async def toggle_preferred_attacker(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Toggle the preferred attacker flag. Only the owner of the game account can toggle."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    champion_user.is_preferred_attacker = not champion_user.is_preferred_attacker
    session.add(champion_user)
    await session.commit()
    await session.refresh(champion_user)
    return ChampionUserResponse.model_validate(champion_user)


@champion_user_controller.get("/{champion_user_id}", response_model=ChampionUserResponse)
async def get_champion_user(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific champion user entry."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    return ChampionUserResponse.model_validate(champion_user)


@champion_user_controller.put("/{champion_user_id}", response_model=ChampionUserResponse)
async def update_champion_user(
    champion_user_id: uuid.UUID,
    body: ChampionUserCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update a champion user entry (rarity, signature)."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    updated = await ChampionUserService.update_champion_user(
        session=session, champion_user=champion_user, rarity=body.rarity, signature=body.signature
    )
    return ChampionUserResponse.model_validate(updated)


@champion_user_controller.delete("/{champion_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_champion_user(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete a champion from a roster."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    await ChampionUserService.delete_champion_user(session, champion_user)


@champion_user_controller.patch("/{champion_user_id}/upgrade", response_model=ChampionUserResponse)
async def upgrade_champion_rank(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Upgrade a champion to the next rank."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    upgraded = await ChampionUserService.upgrade_champion_rank(session, champion_user)
    return ChampionUserResponse.model_validate(upgraded)


@champion_user_controller.patch("/{champion_user_id}/ascend", response_model=ChampionUserResponse)
async def ascend_champion(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Ascend a champion to the next ascension level."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    ascended = await ChampionUserService.ascend_champion(session, champion_user)
    return ChampionUserResponse.model_validate(ascended)
