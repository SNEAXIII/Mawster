import uuid

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.admin.dto_ascension_request import AscensionRequestCreate
from src.services.admin.AscensionRequestService import AscensionRequestService
from src.services.auth.AuthService import AuthService
from src.utils.auth_deps import CurrentUser
from src.utils.db import SessionDep

ascension_request_controller = APIRouter(
    prefix="/ascension-requests",
    tags=["Ascension Requests"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@ascension_request_controller.get("/champion-ids", response_model=list[uuid.UUID])
async def get_requested_champion_ids(session: SessionDep):
    return await AscensionRequestService.get_requested_champion_ids(session)


@ascension_request_controller.post("", status_code=status.HTTP_204_NO_CONTENT)
async def create_ascension_request(
    body: AscensionRequestCreate,
    session: SessionDep,
    current_user: CurrentUser,
):
    await AscensionRequestService.create(session, body.champion_id, current_user.id)
