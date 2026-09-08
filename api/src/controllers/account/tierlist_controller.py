import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.account.dto_tierlist import (
    TierListDetailResponse,
    TierListSaveRequest,
    TierListSummaryResponse,
)
from src.Messages.tierlist_messages import (
    TIER_LIST_NOT_FOUND,
    too_many_tier_lists,
    unknown_champions,
)
from src.models import User
from src.models.tierlist.TierList import TierList
from src.services.account.TierListService import MAX_TIER_LISTS_PER_USER, TierListService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

tierlist_controller = APIRouter(
    prefix="/tierlists",
    tags=["Tier Lists"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)

CurrentUser = Annotated[User, Depends(AuthService.get_current_user_in_jwt)]


async def _get_own_tier_list(
    session: SessionDep, tierlist_id: uuid.UUID, user_id: uuid.UUID
) -> TierList:
    """Load a tier list owned by the current account.

    Someone else's list answers 404, not 403: a tier list is private, and telling an
    outsider that one exists is already telling them something.
    """
    tier_list = await TierListService.get_owned(session, tierlist_id, user_id)
    if tier_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TIER_LIST_NOT_FOUND)
    return tier_list


async def _reject_unknown_champions(session: SessionDep, body: TierListSaveRequest) -> None:
    missing = await TierListService.find_unknown_champions(session, body)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=unknown_champions(len(missing))
        )


@tierlist_controller.get("", response_model=list[TierListSummaryResponse])
async def list_tier_lists(session: SessionDep, current_user: CurrentUser):
    """The current account's tier lists, contents excluded."""
    return await TierListService.list_for_user(session, current_user.id)


@tierlist_controller.post(
    "", response_model=TierListDetailResponse, status_code=status.HTTP_201_CREATED
)
async def create_tier_list(
    body: TierListSaveRequest, session: SessionDep, current_user: CurrentUser
):
    """Create a tier list for the current account."""
    if await TierListService.count_for_user(session, current_user.id) >= MAX_TIER_LISTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=too_many_tier_lists(MAX_TIER_LISTS_PER_USER),
        )
    await _reject_unknown_champions(session, body)
    tier_list = await TierListService.create(session, current_user.id, body)
    return await TierListService.to_detail(session, tier_list)


@tierlist_controller.get("/{tierlist_id}", response_model=TierListDetailResponse)
async def get_tier_list(tierlist_id: uuid.UUID, session: SessionDep, current_user: CurrentUser):
    """One tier list with its rows, rankings and tags."""
    tier_list = await _get_own_tier_list(session, tierlist_id, current_user.id)
    return await TierListService.to_detail(session, tier_list)


@tierlist_controller.put("/{tierlist_id}", response_model=TierListDetailResponse)
async def save_tier_list(
    tierlist_id: uuid.UUID,
    body: TierListSaveRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Replace a tier list whole — the board as the front last showed it."""
    tier_list = await _get_own_tier_list(session, tierlist_id, current_user.id)
    await _reject_unknown_champions(session, body)
    await TierListService.replace(session, tier_list, body)
    return await TierListService.to_detail(session, tier_list)


@tierlist_controller.delete("/{tierlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier_list(tierlist_id: uuid.UUID, session: SessionDep, current_user: CurrentUser):
    """Delete a tier list and everything in it."""
    tier_list = await _get_own_tier_list(session, tierlist_id, current_user.id)
    await TierListService.delete(session, tier_list)
