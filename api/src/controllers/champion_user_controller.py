import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from starlette import status
from src.services.AllianceService import AllianceService
from sqlalchemy.orm import selectinload
from src.models.RequestedUpgrade import RequestedUpgrade
from src.models.ChampionUser import ChampionUser
from src.dto.dto_champion_user import (
    ChampionUserCreateRequest,
    ChampionUserBulkRequest,
    ChampionUserResponse,
    ChampionUserDetailResponse,
)
from src.dto.dto_upgrade_request import (
    UpgradeRequestCreate,
    UpgradeRequestResponse,
)
from src.Messages.champion_user_messages import CHAMPION_USER_NOT_FOUND, NOT_YOUR_CHAMPION
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.models import User
from src.models.GameAccount import GameAccount
from src.services.AuthService import AuthService
from src.services.GameAccountService import GameAccountService
from src.services.ChampionUserService import ChampionUserService
from src.services.UpgradeRequestService import UpgradeRequestService
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
        session=session,
        game_account_id=body.game_account_id,
        champions=champions_data,
    )
    return [ChampionUserDetailResponse.model_validate(e) for e in entries]


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
    The game account must belong to the current user, or the current user
    must be in the same alliance as the target game account."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        if game_account.alliance_id is None or not await AllianceService.is_alliance_member(
            session, current_user.id, game_account.alliance_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own roster or rosters of alliance members",
            )
    entries = await ChampionUserService.get_roster_by_game_account(session, game_account_id)
    return [ChampionUserDetailResponse.model_validate(e) for e in entries]


@champion_user_controller.patch(
    "/{champion_user_id}/preferred-attacker",
    response_model=ChampionUserResponse,
)
async def toggle_preferred_attacker(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Toggle the preferred attacker flag for a champion user entry.
    Only the owner of the game account can toggle this flag."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    champion_user.is_preferred_attacker = not champion_user.is_preferred_attacker
    session.add(champion_user)
    await session.commit()
    await session.refresh(champion_user)
    return ChampionUserResponse.model_validate(champion_user)


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
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    return ChampionUserResponse.model_validate(champion_user)


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
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    updated = await ChampionUserService.update_champion_user(
        session=session,
        champion_user=champion_user,
        rarity=body.rarity,
        signature=body.signature,
    )
    return ChampionUserResponse.model_validate(updated)


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
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
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
    """Upgrade a champion to the next rank (e.g. 7r2 â†’ 7r3)."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    upgraded = await ChampionUserService.upgrade_champion_rank(session, champion_user)
    return ChampionUserResponse.model_validate(upgraded)


@champion_user_controller.patch(
    "/{champion_user_id}/ascend",
    response_model=ChampionUserResponse,
)
async def ascend_champion(
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Ascend a champion to the next ascension level (0 â†’ 1 â†’ 2)."""
    champion_user = await _get_own_champion_user(session, champion_user_id, current_user.id)
    ascended = await ChampionUserService.ascend_champion(session, champion_user)
    return ChampionUserResponse.model_validate(ascended)


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


# --- Upgrade Request Helpers ---


async def _assert_alliance_officer(session, game_account, current_user_id):
    """Verify that the current user is an officer/owner in the target's alliance."""
    if game_account.alliance_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target is not in an alliance",
        )
    await AllianceService.assert_officer_or_owner_by_id(
        session, game_account.alliance_id, current_user_id
    )


def _pick_requester_account(
    user_accounts,
    target_alliance_id,
):
    """Pick the best requester game account (prefer same alliance, fallback to first)."""
    if target_alliance_id:
        for acc in user_accounts:
            if acc.alliance_id == target_alliance_id:
                return acc.id
    return user_accounts[0].id if user_accounts else None


# --- Upgrade Request Endpoints ---


@champion_user_controller.post(
    "/upgrade-requests",
    response_model=UpgradeRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_upgrade_request(
    body: UpgradeRequestCreate,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Request an upgrade for a champion user entry.
    Officers/owners can request for alliance members; anyone can request for themselves."""
    champion_user = await ChampionUserService.get_champion_user(session, body.champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_USER_NOT_FOUND)

    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)

    # Determine the requester's game account (must be in same alliance or self)
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


@champion_user_controller.get(
    "/upgrade-requests/by-account/{game_account_id}",
    response_model=list[UpgradeRequestResponse],
)
async def get_upgrade_requests_by_account(
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all pending upgrade requests for a game account's roster.
    The account must belong to the current user or be in the same alliance."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)

    if game_account.user_id != current_user.id:
        if game_account.alliance_id is None or not await AllianceService.is_alliance_member(
            session, current_user.id, game_account.alliance_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view these upgrade requests",
            )

    requests = await UpgradeRequestService.get_pending_by_game_account(session, game_account_id)
    return [UpgradeRequestResponse.model_validate(r) for r in requests]


@champion_user_controller.delete(
    "/upgrade-requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_upgrade_request(
    request_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Cancel/delete an upgrade request.
    Only an officer or owner of the alliance can cancel."""
    upgrade_request = await session.get(RequestedUpgrade, request_id)
    if upgrade_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Upgrade request not found"
        )

    # Find the champion user to locate the alliance
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

    await AllianceService.assert_officer_or_owner_by_id(
        session, target_account.alliance_id, current_user.id
    )
    await UpgradeRequestService.cancel_upgrade_request(session, request_id)
