import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from starlette import status

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
from src.models import User
from src.models.GameAccount import GameAccount
from src.services.AuthService import AuthService
from src.services.GameAccountService import GameAccountService
from src.services.ChampionUserService import ChampionUserService
from src.services.UpgradeRequestService import UpgradeRequestService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

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
        is_preferred_attacker=body.is_preferred_attacker,
    )
    audit_log("roster.add_champion", user_id=str(current_user.id), detail=f"game_account_id={body.game_account_id} champion_id={body.champion_id}")
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
            "is_preferred_attacker": entry.is_preferred_attacker,
        }
        for entry in body.champions
    ]
    entries = await ChampionUserService.bulk_add_champions(
        session=session,
        game_account_id=body.game_account_id,
        champions=champions_data,
    )
    audit_log("roster.bulk_import", user_id=str(current_user.id), detail=f"game_account_id={body.game_account_id} count={len(entries)}")
    return [
        ChampionUserDetailResponse(
            id=e.id,
            game_account_id=e.game_account_id,
            champion_id=e.champion_id,
            rarity=e.rarity,
            signature=e.signature,
            is_preferred_attacker=e.is_preferred_attacker,
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
    The game account must belong to the current user, or the current user
    must be in the same alliance as the target game account."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")
    if game_account.user_id != current_user.id:
        # Check if current user is in the same alliance
        is_ally = False
        if game_account.alliance_id is not None:
            user_accounts = await session.exec(
                select(GameAccount).where(GameAccount.user_id == current_user.id)
            )
            for acc in user_accounts.all():
                if acc.alliance_id == game_account.alliance_id:
                    is_ally = True
                    break
        if not is_ally:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own roster or rosters of alliance members",
            )
    entries = await ChampionUserService.get_roster_by_game_account(session, game_account_id)
    return [
        ChampionUserDetailResponse(
            id=e.id,
            game_account_id=e.game_account_id,
            champion_id=e.champion_id,
            rarity=e.rarity,
            signature=e.signature,
            is_preferred_attacker=e.is_preferred_attacker,
            champion_name=e.champion.name,
            champion_class=e.champion.champion_class,
            image_url=e.champion.image_url,
        )
        for e in entries
    ]


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
    champion_user = await ChampionUserService.get_champion_user(session, champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None or game_account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your champion")
    champion_user.is_preferred_attacker = not champion_user.is_preferred_attacker
    session.add(champion_user)
    await session.commit()
    await session.refresh(champion_user)
    audit_log(
        "roster.toggle_preferred_attacker",
        user_id=str(current_user.id),
        detail=f"champion_user_id={champion_user_id} is_preferred_attacker={champion_user.is_preferred_attacker}",
    )
    return ChampionUserResponse.from_model(champion_user)


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
    audit_log("roster.delete_champion", user_id=str(current_user.id), detail=f"champion_user_id={champion_user_id}")


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
    audit_log("roster.upgrade_rank", user_id=str(current_user.id), detail=f"champion_user_id={champion_user_id}")
    return ChampionUserResponse.from_model(upgraded)


# ─── Upgrade Request Endpoints ────────────────────────────

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")

    game_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")

    # Determine the requester's game account (must be in same alliance or self)
    user_accounts_result = await session.exec(
        select(GameAccount).where(GameAccount.user_id == current_user.id)
    )
    user_accounts = user_accounts_result.all()

    is_self = game_account.user_id == current_user.id

    if not is_self:
        # Must be in same alliance and be officer/owner
        if game_account.alliance_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Target is not in an alliance",
            )
        from src.services.AllianceService import AllianceService
        alliance = await AllianceService._load_alliance_with_relations(
            session, game_account.alliance_id
        )
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)

    # Pick the requester game account (prefer one in the same alliance, fallback to primary)
    requester_account_id = None
    if game_account.alliance_id:
        for acc in user_accounts:
            if acc.alliance_id == game_account.alliance_id:
                requester_account_id = acc.id
                break
    if requester_account_id is None:
        # fallback: pick the first account
        requester_account_id = user_accounts[0].id if user_accounts else None
    if requester_account_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No game account found")

    upgrade_request = await UpgradeRequestService.create_upgrade_request(
        session=session,
        champion_user_id=body.champion_user_id,
        requester_game_account_id=requester_account_id,
        requested_rarity=body.requested_rarity,
    )

    # Load relationships for response
    from sqlalchemy.orm import selectinload
    from src.models.RequestedUpgrade import RequestedUpgrade
    from src.models.ChampionUser import ChampionUser
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

    audit_log(
        "upgrade_request.create",
        user_id=str(current_user.id),
        detail=f"request_id={loaded.id} champion_user_id={body.champion_user_id} requested_rarity={body.requested_rarity}",
    )

    return UpgradeRequestResponse(
        id=loaded.id,
        champion_user_id=loaded.champion_user_id,
        requester_game_account_id=loaded.requester_game_account_id,
        requester_pseudo=loaded.requester.game_pseudo,
        requested_rarity=loaded.requested_rarity,
        current_rarity=loaded.champion_user.rarity,
        champion_name=loaded.champion_user.champion.name,
        champion_class=loaded.champion_user.champion.champion_class,
        image_url=loaded.champion_user.champion.image_url,
        created_at=loaded.created_at,
        done_at=loaded.done_at,
    )


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found")

    if game_account.user_id != current_user.id:
        is_ally = False
        if game_account.alliance_id is not None:
            user_accounts = await session.exec(
                select(GameAccount).where(GameAccount.user_id == current_user.id)
            )
            for acc in user_accounts.all():
                if acc.alliance_id == game_account.alliance_id:
                    is_ally = True
                    break
        if not is_ally:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view these upgrade requests",
            )

    requests = await UpgradeRequestService.get_pending_by_game_account(session, game_account_id)
    return [
        UpgradeRequestResponse(
            id=r.id,
            champion_user_id=r.champion_user_id,
            requester_game_account_id=r.requester_game_account_id,
            requester_pseudo=r.requester.game_pseudo,
            requested_rarity=r.requested_rarity,
            current_rarity=r.champion_user.rarity,
            champion_name=r.champion_user.champion.name,
            champion_class=r.champion_user.champion.champion_class,
            image_url=r.champion_user.champion.image_url,
            created_at=r.created_at,
            done_at=r.done_at,
        )
        for r in requests
    ]


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
    from src.models.RequestedUpgrade import RequestedUpgrade
    upgrade_request = await session.get(RequestedUpgrade, request_id)
    if upgrade_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upgrade request not found")

    # Find the champion user to locate the alliance
    champion_user = await ChampionUserService.get_champion_user(session, upgrade_request.champion_user_id)
    if champion_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")

    target_account = await GameAccountService.get_game_account(session, champion_user.game_account_id)
    if target_account is None or target_account.alliance_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to cancel this upgrade request")

    from src.services.AllianceService import AllianceService
    alliance = await AllianceService._load_alliance_with_relations(session, target_account.alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
    await UpgradeRequestService.cancel_upgrade_request(session, request_id)
    audit_log("upgrade_request.cancel", user_id=str(current_user.id), detail=f"request_id={request_id}")
