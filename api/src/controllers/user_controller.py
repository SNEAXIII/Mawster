from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette import status

from src.Messages.user_messages import (
    TARGET_USER_DELETED_SUCCESSFULLY,
)
from src.models import User
from src.services.AuthService import AuthService
from src.services.UserService import UserService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

user_controller = APIRouter(
    prefix="/user",
    tags=["User"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)

CONFIRMATION_TEXT = "SUPPRIMER"


class DeleteAccountRequest(BaseModel):
    """DTO pour la suppression de compte.
    L'utilisateur doit envoyer le texte de confirmation exact."""
    confirmation: str = Field(..., examples=[CONFIRMATION_TEXT])


@user_controller.delete("/delete", status_code=200)
async def delete_user(
    body: DeleteAccountRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    if body.confirmation != CONFIRMATION_TEXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vous devez saisir '{CONFIRMATION_TEXT}' pour confirmer la suppression.",
        )
    await UserService.self_delete(session, current_user)
    audit_log("user.self_delete", user_id=str(current_user.id))
    return {"message": TARGET_USER_DELETED_SUCCESSFULLY}
