import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.account.game.dto_game_account import (
    DeletedGameAccountResponse,
    GameAccountCreateRequest,
    GameAccountResponse,
)
from src.dto.account.game.dto_mastery import (
    GameAccountMasteryResponse,
    GameAccountMasteryUpsertItem,
)
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND, NOT_YOUR_GAME_ACCOUNT
from src.models import User
from src.models.Base import as_utc
from src.models.user.GameAccount import GameAccount
from src.services.account.game.GameAccountService import GameAccountService
from src.services.account.MasteryService import MasteryService
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

game_account_controller = APIRouter(
    prefix="/game-accounts",
    tags=["Game Accounts"],
    dependencies=[
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


def _to_response(account: GameAccount) -> GameAccountResponse:
    """Convert a GameAccount ORM object to a response DTO, including alliance info."""
    return GameAccountResponse.model_validate(account)


def _to_deleted_response(account: GameAccount) -> DeletedGameAccountResponse:
    """Convert a deleted GameAccount to a response DTO carrying its restore deadline."""
    # Timestamps read back from the DB are naive: normalize them so the client
    # always gets UTC instants it can compare with its own clock.
    return DeletedGameAccountResponse(
        id=account.id,
        game_pseudo=account.game_pseudo,
        created_at=as_utc(account.created_at),
        deleted_at=as_utc(account.deleted_at),
        restorable_until=GameAccountService.restorable_until(account),
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
    result = await GameAccountService.create_game_account(
        session=session,
        user_id=current_user.id,
        game_pseudo=body.game_pseudo,
        is_primary=body.is_primary,
    )
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
    "/deleted",
    response_model=list[DeletedGameAccountResponse],
)
async def get_my_deleted_game_accounts(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """List the current user's deleted game accounts that can still be restored.

    Accounts whose restore window has elapsed are never listed: they are lost
    for good as far as the player is concerned."""
    accounts = await GameAccountService.get_restorable_game_accounts(
        session=session,
        user_id=current_user.id,
    )
    return [_to_deleted_response(acc) for acc in accounts]


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
    """Logically delete a game account. Must belong to the current user and must not
    belong to an alliance. The account can be restored for a few days, and keeps
    counting against the account quota until that window closes."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    await GameAccountService.delete_game_account(session, game_account)


@game_account_controller.post(
    "/{game_account_id}/restore",
    response_model=GameAccountResponse,
)
async def restore_game_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Restore a deleted game account. Must belong to the current user and still
    be inside the restore window."""
    game_account = await GameAccountService.get_game_account(
        session, game_account_id, include_deleted=True
    )
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    restored = await GameAccountService.restore_game_account(session, game_account)
    return _to_response(restored)


@game_account_controller.get(
    "/{game_account_id}/masteries",
    response_model=list[GameAccountMasteryResponse],
)
async def get_game_account_masteries(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get mastery values for a game account. Visible to owner or alliance members."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id and not await AllianceService.can_view_roster(
        session, current_user.id, game_account
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_GAME_ACCOUNT)
    return await MasteryService.get_for_account(session, game_account_id)


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
    return await MasteryService.upsert_for_account(session, game_account_id, body)
