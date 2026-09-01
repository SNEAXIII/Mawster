import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlmodel import Field

from src.enums.NoteReportStatus import NoteReportStatus
from src.models.Base import FK_GAME_ACCOUNT, FK_USER, FK_WAR_FIGHT_NOTE, TimestampMixin, UUIDBase


class NoteReport(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "note_report"

    note_id: uuid.UUID = Field(foreign_key=FK_WAR_FIGHT_NOTE)
    reporter_game_account_id: uuid.UUID = Field(foreign_key=FK_GAME_ACCOUNT)
    reason: str | None = Field(default=None, sa_column=sa.Column(sa.Text, nullable=True))
    status: NoteReportStatus = Field(default=NoteReportStatus.pending)
    resolved_by_id: uuid.UUID | None = Field(default=None, foreign_key=FK_USER)
    resolved_at: datetime | None = Field(default=None)
