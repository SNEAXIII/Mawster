import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType
from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceInvitation(UUIDBase, TimestampMixin, table=True):
    """An invitation for a game account to join or visit an alliance."""

    __tablename__ = "alliance_invitation"

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    invited_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    status: InvitationStatus = Field(default=InvitationStatus.PENDING)
    type: InvitationType = Field(default=InvitationType.MEMBER)
    responded_at: datetime | None = Field(default=None)

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
