import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_defense import (
    DefensePlacementCreateRequest,
    DefensePlacementResponse,
    DefenseSummaryResponse,
)
from src.models import User
from src.models.GameAccount import GameAccount
from src.services.AllianceService import AllianceService
from src.services.AuthService import AuthService
from src.services.DefensePlacementService import DefensePlacementService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log
from sqlmodel import select

defense_controller = APIRouter(
    prefix="/alliances/{alliance_id}/defense",
    tags=["Defense"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


async def _get_user_account_in_alliance(
    session: SessionDep,
    current_user: User,
    alliance_id: uuid.UUID,
) -> GameAccount:
    """Find the current user's game account that belongs to this alliance."""
    result = await session.exec(
        select(GameAccount).where(
            GameAccount.user_id == current_user.id,
            GameAccount.alliance_id == alliance_id,
        )
    )
    account = result.first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this alliance",
        )
    return account


def _to_placement_response(p) -> DefensePlacementResponse:
    return DefensePlacementResponse(
        id=p.id,
        alliance_id=p.alliance_id,
        battlegroup=p.battlegroup,
        node_number=p.node_number,
        champion_user_id=p.champion_user_id,
        game_account_id=p.game_account_id,
        game_pseudo=p.game_account.game_pseudo,
        champion_name=p.champion_user.champion.name,
        champion_class=p.champion_user.champion.champion_class,
        champion_image_url=p.champion_user.champion.image_url,
        rarity=p.champion_user.rarity,
        placed_by_id=p.placed_by_id,
        placed_by_pseudo=p.placed_by.game_pseudo if p.placed_by else None,
        created_at=p.created_at,
    )


@defense_controller.get(
    "/bg/{battlegroup}",
    response_model=DefenseSummaryResponse,
)
async def get_defense(
    alliance_id: uuid.UUID,
    battlegroup: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the full defense layout for a battlegroup."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    await _get_user_account_in_alliance(session, current_user, alliance_id)

    placements = await DefensePlacementService.get_defense(session, alliance_id, battlegroup)

    member_counts: dict[str, int] = {}
    for p in placements:
        key = str(p.game_account_id)
        member_counts[key] = member_counts.get(key, 0) + 1

    return DefenseSummaryResponse(
        alliance_id=alliance_id,
        battlegroup=battlegroup,
        placements=[_to_placement_response(p) for p in placements],
        member_defender_counts=member_counts,
    )


@defense_controller.post(
    "/bg/{battlegroup}/place",
    response_model=DefensePlacementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_defender(
    alliance_id: uuid.UUID,
    battlegroup: int,
    body: DefensePlacementCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Place a defender on a node. Owner/officer can place for any BG member."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    my_account = await _get_user_account_in_alliance(session, current_user, alliance_id)

    # Check if user is owner/officer (can place for others) or placing for themselves
    alliance = await AllianceService._load_alliance_with_relations(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

    is_manager = False
    try:
        await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
        is_manager = True
    except HTTPException:
        pass

    if not is_manager and body.game_account_id != my_account.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers/owners can place defenders for other players",
        )

    placement = await DefensePlacementService.place_defender(
        session=session,
        alliance_id=alliance_id,
        battlegroup=battlegroup,
        node_number=body.node_number,
        champion_user_id=body.champion_user_id,
        game_account_id=body.game_account_id,
        placed_by_id=my_account.id,
    )

    audit_log(
        "defense.place",
        user_id=str(current_user.id),
        detail=f"alliance_id={alliance_id} bg={battlegroup} node={body.node_number}",
    )

    return _to_placement_response(placement)


@defense_controller.delete(
    "/bg/{battlegroup}/node/{node_number}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_defender(
    alliance_id: uuid.UUID,
    battlegroup: int,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a defender from a node. Officers/owners only."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    await _get_user_account_in_alliance(session, current_user, alliance_id)

    alliance = await AllianceService._load_alliance_with_relations(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)

    await DefensePlacementService.remove_defender(session, alliance_id, battlegroup, node_number)

    audit_log(
        "defense.remove",
        user_id=str(current_user.id),
        detail=f"alliance_id={alliance_id} bg={battlegroup} node={node_number}",
    )


@defense_controller.delete(
    "/bg/{battlegroup}/clear",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def clear_defense(
    alliance_id: uuid.UUID,
    battlegroup: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Clear all defense placements for a battlegroup. Officers/owners only."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    await _get_user_account_in_alliance(session, current_user, alliance_id)

    alliance = await AllianceService._load_alliance_with_relations(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)

    count = await DefensePlacementService.clear_defense(session, alliance_id, battlegroup)

    audit_log(
        "defense.clear",
        user_id=str(current_user.id),
        detail=f"alliance_id={alliance_id} bg={battlegroup} cleared={count}",
    )


@defense_controller.get(
    "/bg/{battlegroup}/available-champions",
)
async def get_available_champions(
    alliance_id: uuid.UUID,
    battlegroup: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all champions available for placement (not already placed, from BG members)."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    await _get_user_account_in_alliance(session, current_user, alliance_id)

    return await DefensePlacementService.get_available_champions(
        session, alliance_id, battlegroup
    )


@defense_controller.get(
    "/bg/{battlegroup}/members",
)
async def get_bg_members(
    alliance_id: uuid.UUID,
    battlegroup: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all members in a battlegroup with their defender counts."""
    if battlegroup < 1 or battlegroup > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Battlegroup must be 1, 2, or 3")

    await _get_user_account_in_alliance(session, current_user, alliance_id)

    return await DefensePlacementService.get_bg_members_with_counts(
        session, alliance_id, battlegroup
    )
