import uuid

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.admin.dto_ascension_request import AscensionRequestResponse
from src.services.admin.AscensionRequestService import AscensionRequestService
from src.services.auth.AuthService import AuthService
from src.utils.audited_route import AuditedRoute
from src.utils.db import SessionDep

ascension_request_admin_controller = APIRouter(
    prefix="/admin/ascension-requests",
    tags=["Ascension Requests (Admin)"],
    route_class=AuditedRoute,
    dependencies=[
        Depends(AuthService.require_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@ascension_request_admin_controller.get("", response_model=list[AscensionRequestResponse])
async def get_pending_ascension_requests(session: SessionDep):
    return await AscensionRequestService.get_pending(session)


@ascension_request_admin_controller.post(
    "/{request_id}/accept", status_code=status.HTTP_204_NO_CONTENT
)
async def accept_ascension_request(session: SessionDep, request_id: uuid.UUID):
    await AscensionRequestService.accept(session, request_id)


@ascension_request_admin_controller.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def refuse_ascension_request(session: SessionDep, request_id: uuid.UUID):
    await AscensionRequestService.refuse(session, request_id)
