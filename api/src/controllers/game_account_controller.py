import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game_account import (
    GameAccountCreateRequest,
    GameAccountResponse,
)
from src.dto.dto_mastery import GameAccountMasteryUpsertItem, GameAccountMasteryResponse
from src.models.Mastery import Mastery
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND, NOT_YOUR_GAME_ACCOUNT
from src.models import User
from src.models.GameAccount import GameAccount
from src.services.AuthService import AuthService
from src.services.GameAccountService import GameAccountService
from src.services.MasteryService import MasteryService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

game_account_controller = APIRouter(
    prefix="/game-accounts",
    tags=["Game Accounts"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


def _to_response(account: GameAccount) -> GameAccountResponse:
    """Convert a GameAccount ORM object to a response DTO, including alliance info."""
    return GameAccountResponse.model_validate(account)


async def _mastery_responses(
    session: SessionDep, rows: list
) -> list[GameAccountMasteryResponse]:
    result = []
    for row in rows:
        mastery = await session.get(Mastery, row.mastery_id)
        result.append(GameAccountMasteryResponse(
            id=row.id,
            mastery_id=row.mastery_id,
            mastery_name=mastery.name if mastery else "",
            mastery_max_value=mastery.max_value if mastery else 0,
            mastery_order=mastery.order if mastery else 0,
            unlocked=row.unlocked,
            attack=row.attack,
            defense=row.defense,
        ))
    result.sort(key=lambda r: r.mastery_order)
    return result


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
    result = await GameAccountService.create_game_account(
        session=session,
        user_id=current_user.id,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )
    audit_log("game_account.create", user_id=str(current_user.id), detail=f"game_account_id={result.id}")
    return result


@game_account_controller.get(
    "",
    response_model=list[GameAccountResponse],
)
async def get_my_game_accounts(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all game accounts for the current user, sorted by primary first, with alliance info."""
    accounts = await GameAccountService.get_game_accounts_by_user(
        session=session,
        user_id=current_user.id,
        load_alliance=True,
    )
    return [_to_response(acc) for acc in accounts]


@game_account_controller.get(
    "/{game_account_id}",
    response_model=GameAccountResponse,
)
async def get_game_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific game account by ID. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    return game_account


@game_account_controller.put(
    "/{game_account_id}",
    response_model=GameAccountResponse,
)
async def update_game_account(
    game_account_id: uuid.UUID,
    body: GameAccountCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update a game account. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    result = await GameAccountService.update_game_account(
        session=session,
        game_account=game_account,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )
    audit_log("game_account.update", user_id=str(current_user.id), detail=f"game_account_id={game_account_id}")
    return result


@game_account_controller.delete(
    "/{game_account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_game_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete a game account. Must belong to the current user."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    await GameAccountService.delete_game_account(session, game_account)
    audit_log("game_account.delete", user_id=str(current_user.id), detail=f"game_account_id={game_account_id}")


@game_account_controller.get(
    "/{game_account_id}/masteries",
    response_model=list[GameAccountMasteryResponse],
)
async def get_game_account_masteries(
    game_account_id: uuid.UUID,
    session: SessionDep,
):
    """Get mastery values for a game account. Visible to all authenticated members."""
    rows = await MasteryService.get_for_account(session, game_account_id)
    return await _mastery_responses(session, rows)


@game_account_controller.put(
    "/{game_account_id}/masteries",
    response_model=list[GameAccountMasteryResponse],
)
async def upsert_game_account_masteries(
    game_account_id: uuid.UUID,
    body: list[GameAccountMasteryUpsertItem],
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Bulk upsert mastery values. Only the account owner can call this."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    rows = await MasteryService.upsert_for_account(session, game_account_id, body)
    return await _mastery_responses(session, rows)
