from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.models import User
from src.services.admin.ModerationService import ModerationService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

me_moderation_controller = APIRouter(tags=["Moderation"])


class MyMuteInfo(BaseModel):
    reason: str
    expires_at: datetime | None = None


class MyWarnInfo(BaseModel):
    reason: str
    created_at: datetime


class MyModerationResponse(BaseModel):
    mute: MyMuteInfo | None = None
    warns: list[MyWarnInfo] = []


@me_moderation_controller.get("/me/moderation", response_model=MyModerationResponse)
async def my_moderation(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Return the caller's own active mute (reason visible to them) and their warnings."""
    mute = await ModerationService.get_active_mute(session, current_user.id)
    warns = await ModerationService.list_warns(session, user_id=current_user.id)
    return MyModerationResponse(
        mute=MyMuteInfo(reason=mute.reason, expires_at=mute.expires_at) if mute else None,
        warns=[MyWarnInfo(reason=w.reason, created_at=w.created_at) for w in warns],
    )
