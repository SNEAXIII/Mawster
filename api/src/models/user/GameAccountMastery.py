import uuid

import sqlalchemy as sa
from sqlmodel import Field

from src.models.Base import UUIDBase


class GameAccountMastery(UUIDBase, table=True):
    __tablename__ = "game_account_mastery"
    __table_args__ = (
        sa.UniqueConstraint("game_account_id", "mastery_id", name="uq_account_mastery"),
    )

    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    mastery_id: uuid.UUID = Field(foreign_key="mastery.id")
    unlocked: int = Field(default=0, ge=0)
    attack: int = Field(default=0, ge=0)
    defense: int = Field(default=0, ge=0)
