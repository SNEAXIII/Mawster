import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.dto.account.game.dto_upgrade_request import UpgradeRequestCreate, UpgradeRequestResponse
from src.Messages.champion_user_messages import CHAMPION_USER_NOT_FOUND
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.models import User
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.RequestedUpgrade import RequestedUpgrade
from src.services.account.game.ChampionUserService import ChampionUserService
from src.services.account.game.GameAccountService import GameAccountService
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.UpgradeRequestService import UpgradeRequestService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

upgrade_request_controller = APIRouter(
    prefix="/champion-users",
    tags=["Champion Users"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


async def _assert_alliance_officer(session, game_account, current_user_id):
    if game_account.alliance_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Target is not in an alliance"
        )
    await AllianceService.require_officer(session, game_account.alliance_id, current_user_id)


def _pick_requester_account(user_accounts, target_alliance_id):
    if target_alliance_id:
        for acc in user_accounts:
            if acc.alliance_id == target_alliance_id:
                return acc.id
    return user_accounts[0].id if user_accounts else None


@upgrade_request_controller.post(
    "/upgrade-requests",
    response_model=UpgradeRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_upgrade_request(
    body: UpgradeRequestCreate,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Request an upgrade for a champion. Officers/owners can request for alliance members."""
    champion_user = await ChampionUserService.get_champion_user(session, body.champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_USER_NOT_FOUND)

    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)

    user_accounts_result = await session.exec(
        select(GameAccount).where(GameAccount.user_id == current_user.id)
    )
    user_accounts = user_accounts_result.all()

    if game_account.user_id != current_user.id:
        await _assert_alliance_officer(session, game_account, current_user.id)

    requester_account_id = _pick_requester_account(user_accounts, game_account.alliance_id)
    if requester_account_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No game account found")

    upgrade_request = await UpgradeRequestService.create_upgrade_request(
        session=session,
        champion_user_id=body.champion_user_id,
        requester_game_account_id=requester_account_id,
        requested_rarity=body.requested_rarity,
    )

    stmt = (
        select(RequestedUpgrade)
        .where(RequestedUpgrade.id == upgrade_request.id)
        .options(
            selectinload(RequestedUpgrade.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            selectinload(RequestedUpgrade.requester),  # type: ignore[arg-type]
        )
    )
    result = await session.exec(stmt)
    loaded = result.one()
    return UpgradeRequestResponse.model_validate(loaded)


@upgrade_request_controller.get(
    "/upgrade-requests/by-account/{game_account_id}",
    response_model=list[UpgradeRequestResponse],
)
async def get_upgrade_requests_by_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all pending upgrade requests for a game account's roster."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)

    if game_account.user_id != current_user.id:
        if not await AllianceService.can_view_roster(session, current_user.id, game_account):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view these upgrade requests",
            )

    requests = await UpgradeRequestService.get_pending_by_game_account(session, game_account_id)
    return [UpgradeRequestResponse.model_validate(r) for r in requests]


@upgrade_request_controller.delete(
    "/upgrade-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def cancel_upgrade_request(
    request_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Cancel an upgrade request. Only an officer or owner of the alliance can cancel."""
    upgrade_request = await session.get(RequestedUpgrade, request_id)
    if upgrade_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Upgrade request not found"
        )

    champion_user = await ChampionUserService.get_champion_user(
        session, upgrade_request.champion_user_id
    )
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_USER_NOT_FOUND)

    target_account = await GameAccountService.get_game_account(
        session, champion_user.game_account_id
    )
    if target_account is None or target_account.alliance_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this upgrade request",
        )

    await AllianceService.require_officer(session, target_account.alliance_id, current_user.id)
    await UpgradeRequestService.cancel_upgrade_request(session, request_id)
