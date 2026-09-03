import uuid
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_ALLIANCE,
    SoftDelete,
    TimestampMixin,
    UserFk,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.alliance.AllianceInvitation import AllianceInvitation
    from src.models.alliance.AllianceOfficer import AllianceOfficer
    from src.models.alliance.AllianceStrategist import AllianceStrategist
    from src.models.alliance.AllianceVisitor import AllianceVisitor
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.champion.RequestedUpgrade import RequestedUpgrade
    from src.models.user.User import User


class GameAccount(UUIDBase, UserFk, TimestampMixin, SoftDelete, table=True):
    __tablename__ = "game_account"

    alliance_id: uuid.UUID | None = Field(default=None, foreign_key=FK_ALLIANCE)
    alliance_group: int | None = Field(default=None)  # 1, 2, 3 or None
    game_pseudo: str = Field(max_length=16)
    is_primary: bool = Field(default=False)
    # Logical deletion: the account stays in DB but is invisible to its owner.
    # It can be restored for RESTORE_WINDOW_DAYS (see GameAccountService), after
    # which it is unreachable — while still counting against the account quota
    # until then.

    # Relations
    user: "User" = Relationship(back_populates="game_accounts")
    alliance: Optional["Alliance"] = Relationship(
        back_populates="members",
        sa_relationship_kwargs={"foreign_keys": "[GameAccount.alliance_id]"},
    )
    owned_alliance: Optional["Alliance"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={"foreign_keys": "[Alliance.owner_id]"},
    )
    roster: list["ChampionUser"] = Relationship(back_populates="game_account")
    officer_entries: list["AllianceOfficer"] = Relationship(back_populates="game_account")
    strategist_entries: list["AllianceStrategist"] = Relationship(back_populates="game_account")
    received_invitations: list["AllianceInvitation"] = Relationship(
        back_populates="game_account",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.game_account_id]"},
    )
    sent_invitations: list["AllianceInvitation"] = Relationship(
        back_populates="invited_by",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.invited_by_game_account_id]"},
    )
    visited_alliances: list["AllianceVisitor"] = Relationship(back_populates="game_account")
    requested_upgrades: list["RequestedUpgrade"] = Relationship(
        back_populates="requester",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.requester_game_account_id]"},
    )
