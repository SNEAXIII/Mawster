import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

from src.enums.InvitationStatus import InvitationStatus

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceInvitation(SQLModel, table=True):
    """An invitation for a game account to join an alliance."""
    __tablename__ = "alliance_invitation"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    invited_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    status: InvitationStatus = Field(default=InvitationStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.now)
    responded_at: Optional[datetime] = Field(default=None)

    # Relations
    alliance: "Alliance" = Relationship(
        back_populates="invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.alliance_id]"},
    )
    game_account: "GameAccount" = Relationship(
        back_populates="received_invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.game_account_id]"},
    )
    invited_by: "GameAccount" = Relationship(
        back_populates="sent_invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.invited_by_game_account_id]"},
    )
