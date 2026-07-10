import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status

from src.dto.alliance.dto_matchup import (
    MatchupEvaluationRow,
    MatchupRatingResponse,
    MatchupSynergyResponse,
    MatchupUpsertRequest,
)
from src.models import User
from src.models.MatchupRating import MatchupRating
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.MatchupService import MatchupService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

matchup_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@matchup_controller.get("/{alliance_id}/matchups", response_model=list[MatchupRatingResponse])
async def list_matchups(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    champion_id: Optional[uuid.UUID] = None,
    defender_champion_id: Optional[uuid.UUID] = None,
    node_number: Optional[int] = Query(default=None, ge=1, le=50),
):
    """List the alliance's matchup ratings. Members, officers, owner or visitors."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    ratings = await MatchupService.list_ratings(
        session, alliance_id, champion_id, defender_champion_id, node_number
    )
    return [_to_rating_response(rating) for rating in ratings]


@matchup_controller.get(
    "/{alliance_id}/matchups/evaluation", response_model=list[MatchupEvaluationRow]
)
async def evaluate_matchups(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    defender_champion_id: Optional[uuid.UUID] = None,
    node_number: Optional[int] = Query(default=None, ge=1, le=50),
    champion_id: Optional[uuid.UUID] = None,
    game_account_id: Optional[uuid.UUID] = None,
):
    """Rank rated attackers against the selected defender and/or node."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await MatchupService.evaluate(
        session, alliance_id, defender_champion_id, node_number, champion_id, game_account_id
    )


@matchup_controller.post(
    "/{alliance_id}/matchups",
    response_model=list[MatchupRatingResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upsert_matchups(
    alliance_id: uuid.UUID,
    request: MatchupUpsertRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Rate a champion against a defender, a node, or both at once. Officers and owner only."""
    author = await AllianceService.assert_officer_or_owner_by_id(
        session, alliance_id, current_user.id
    )
    ratings = await MatchupService.upsert(session, alliance_id, author.id, request)
    return [_to_rating_response(rating) for rating in ratings]


# TODO: no PATCH route. POST is idempotent on (champion_id, target_key), so editing a rating is
# re-submitting it. Add a real PATCH — loading the row by id, 404 when it belongs to another
# alliance — only if a caller genuinely needs to address a rating by its id.


@matchup_controller.delete(
    "/{alliance_id}/matchups/{rating_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_matchup(
    alliance_id: uuid.UUID,
    rating_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete a rating and its synergies. Officers and owner only."""
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    await MatchupService.delete(session, alliance_id, rating_id)


def _to_rating_response(rating: MatchupRating) -> MatchupRatingResponse:
    """Flatten the eagerly-loaded champion relationships into the response shape."""
    return MatchupRatingResponse(
        id=rating.id,
        champion=MatchupService.champion_ref(rating.champion),
        target_type=rating.target_type,
        defender=(
            MatchupService.champion_ref(rating.defender_champion)
            if rating.defender_champion
            else None
        ),
        node_number=rating.node_number,
        verdict=rating.verdict,
        prefight=(
            MatchupService.champion_ref(rating.prefight_champion)
            if rating.prefight_champion
            else None
        ),
        synergies=[
            MatchupSynergyResponse(
                **MatchupService.champion_ref(synergy.champion).model_dump(),
                is_required=synergy.is_required,
            )
            for synergy in rating.synergies
        ],
        updated_at=rating.updated_at,
    )
