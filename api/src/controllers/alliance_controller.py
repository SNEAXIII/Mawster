import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    AllianceAddAdjointRequest,
    AllianceAdjointResponse,
    AllianceCreateRequest,
    AllianceRemoveAdjointRequest,
    AllianceResponse,
)
from src.models import User
from src.models.Alliance import Alliance
from src.services.AuthService import AuthService
from src.services.GameService import AllianceService
from src.utils.db import SessionDep

alliance_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


def _to_response(alliance: Alliance) -> AllianceResponse:
    """Convert an Alliance ORM object (with loaded relations) to a response DTO."""
    return AllianceResponse(
        id=alliance.id,
        name=alliance.name,
        tag=alliance.tag,
        owner_id=alliance.owner_id,
        owner_pseudo=alliance.owner.game_pseudo,
        created_at=alliance.created_at,
        adjoints=[
            AllianceAdjointResponse(
                id=adj.id,
                game_account_id=adj.game_account_id,
                game_pseudo=adj.game_account.game_pseudo,
                assigned_at=adj.assigned_at,
            )
            for adj in alliance.adjoints
        ],
    )


@alliance_controller.post(
    "",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_alliance(
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Create a new alliance. The caller must provide their game account as owner."""
    alliance = await AllianceService.create_alliance(
        session=session,
        name=body.name,
        tag=body.tag,
        owner_id=body.owner_id,
    )
    return _to_response(alliance)


@alliance_controller.get(
    "",
    response_model=list[AllianceResponse],
)
async def get_all_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all alliances."""
    alliances = await AllianceService.get_all_alliances(session)
    return [_to_response(a) for a in alliances]


@alliance_controller.get(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def get_alliance(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific alliance by ID."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    return _to_response(alliance)


@alliance_controller.put(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def update_alliance(
    alliance_id: uuid.UUID,
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update an alliance. Only the owner can update."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    updated = await AllianceService.update_alliance(
        session=session,
        alliance=alliance,
        name=body.name,
        tag=body.tag,
    )
    return _to_response(updated)


@alliance_controller.delete(
    "/{alliance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_alliance(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete an alliance."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService.delete_alliance(session, alliance)


# ---- Adjoint management ----

@alliance_controller.post(
    "/{alliance_id}/adjoints",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_adjoint(
    alliance_id: uuid.UUID,
    body: AllianceAddAdjointRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add an adjoint (deputy) to an alliance. Only the owner should do this."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    updated = await AllianceService.add_adjoint(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
    )
    return _to_response(updated)


@alliance_controller.delete(
    "/{alliance_id}/adjoints",
    response_model=AllianceResponse,
)
async def remove_adjoint(
    alliance_id: uuid.UUID,
    body: AllianceRemoveAdjointRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove an adjoint from an alliance."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    updated = await AllianceService.remove_adjoint(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
    )
    return _to_response(updated)
