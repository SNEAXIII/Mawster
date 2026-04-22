import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_defense import (
    DefensePlacementCreateRequest,
    DefensePlacementResponse,
    DefenseSummaryResponse,
    DefenseExportItem,
    DefenseImportRequest,
    DefenseImportReport,
)
from src.models import User
from src.services.AllianceService import AllianceService
from src.services.AuthService import AuthService
from src.services.DefensePlacementService import DefensePlacementService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log
from src.utils.path_params import BattlegroupPath

defense_controller = APIRouter(
    prefix="/alliances/{alliance_id}/defense",
    tags=["Defense"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


def _to_placement_response(p) -> DefensePlacementResponse:
    return DefensePlacementResponse.model_validate(p)


@defense_controller.get(
    "/bg/{battlegroup}",
    response_model=DefenseSummaryResponse,
)
async def get_defense(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the full defense layout for a battlegroup."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)

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
    battlegroup: BattlegroupPath,
    body: DefensePlacementCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Place a defender on a node. Owner/officer can place for any BG member."""
    my_account = await AllianceService.get_user_account_in_alliance(
        session, current_user.id, alliance_id
    )

    # Check if user is owner/officer (can place for others) or placing for themselves
    is_manager = False
    try:
        await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
        is_manager = True
    except HTTPException as exc:
        if exc.status_code != status.HTTP_403_FORBIDDEN:
            raise

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
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a defender from a node. Officers/owners only."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)

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
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Clear all defense placements for a battlegroup. Officers/owners only."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)

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
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all champions available for placement (not already placed, from BG members)."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)

    return await DefensePlacementService.get_available_champions(session, alliance_id, battlegroup)


@defense_controller.get(
    "/bg/{battlegroup}/members",
)
async def get_bg_members(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all members in a battlegroup with their defender counts."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)

    return await DefensePlacementService.get_bg_members_with_counts(
        session, alliance_id, battlegroup
    )


# =================== Export / Import ===================


@defense_controller.get(
    "/bg/{battlegroup}/export",
    response_model=list[DefenseExportItem],
)
async def export_defense(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Export the current defense as portable JSON (no IDs). Officers/owners only."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)

    items = await DefensePlacementService.export_defense(session, alliance_id, battlegroup)

    audit_log(
        "defense.export",
        user_id=str(current_user.id),
        detail=f"alliance_id={alliance_id} bg={battlegroup} count={len(items)}",
    )
    return items


@defense_controller.post(
    "/bg/{battlegroup}/import",
    response_model=DefenseImportReport,
)
async def import_defense(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    body: DefenseImportRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Import a defense layout from JSON. Clears existing defense first.
    Officers/owners only. Returns a before/after comparison + errors."""
    my_account = await AllianceService.get_user_account_in_alliance(
        session, current_user.id, alliance_id
    )
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)

    (
        before,
        after,
        errors,
        success_count,
        error_count,
    ) = await DefensePlacementService.import_defense(
        session=session,
        alliance_id=alliance_id,
        battlegroup=battlegroup,
        items=body.placements,
        placed_by_id=my_account.id,
    )

    audit_log(
        "defense.import",
        user_id=str(current_user.id),
        detail=f"alliance_id={alliance_id} bg={battlegroup} ok={success_count} err={error_count}",
    )

    return DefenseImportReport(
        before=before,
        after=after,
        errors=errors,
        success_count=success_count,
        error_count=error_count,
    )
