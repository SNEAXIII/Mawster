import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

from src.enums.NoteReportStatus import NoteReportStatus


class NoteReport(SQLModel, table=True):
    __tablename__ = "note_report"
    __table_args__ = (
        sa.UniqueConstraint(
            "note_id",
            "reporter_game_account_id",
            "status",
            name="uq_note_report_active_per_account",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="war_fight_note.id")
    reporter_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    reason: Optional[str] = Field(default=None, sa_column=sa.Column(sa.Text, nullable=True))
    status: NoteReportStatus = Field(default=NoteReportStatus.pending)
    created_at: datetime = Field(default_factory=datetime.now)
    resolved_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    resolved_at: Optional[datetime] = Field(default=None)
