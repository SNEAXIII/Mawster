from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    AllianceCreateRequest,
    AllianceResponse,
)
from src.models import User
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
    """Create a new alliance. URL field will be added later (TODO)."""
    return await AllianceService.create_alliance(
        session=session,
        name=body.name,
        tag=body.tag,
        description=body.description,
    )


@alliance_controller.get(
    "",
    response_model=list[AllianceResponse],
)
async def get_all_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all alliances."""
    return await AllianceService.get_all_alliances(session)


@alliance_controller.get(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def get_alliance(
    alliance_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific alliance by ID."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    return alliance


@alliance_controller.put(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def update_alliance(
    alliance_id: int,
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update an alliance."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    return await AllianceService.update_alliance(
        session=session,
        alliance=alliance,
        name=body.name,
        tag=body.tag,
        description=body.description,
    )


@alliance_controller.delete(
    "/{alliance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_alliance(
    alliance_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete an alliance."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService.delete_alliance(session, alliance)
