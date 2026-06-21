import uuid
from datetime import datetime

from sqlmodel import and_, or_, select

from src.models.UserMute import UserMute
from src.utils.db import SessionDep


class ModerationService:
    @classmethod
    async def is_user_muted(cls, session: SessionDep, user_id: uuid.UUID) -> bool:
        now = datetime.now()
        mute = (
            await session.exec(
                select(UserMute).where(
                    and_(
                        UserMute.user_id == user_id,
                        UserMute.lifted_at.is_(None),
                        or_(UserMute.expires_at.is_(None), UserMute.expires_at > now),
                    )
                )
            )
        ).first()
        return mute is not None
