import uuid

from sqlmodel import Field

from src.models.Base import FK_WAR_DEFENSE_PLACEMENT, Ascension, Rank, TimestampMixin, UUIDBase


class WarFightRecord(UUIDBase, TimestampMixin, table=True):
    """One fought placement, freezing the only attacker stats an upgrade could rewrite."""

    __tablename__ = "war_fight_record"

    war_defense_placement_id: uuid.UUID = Field(foreign_key=FK_WAR_DEFENSE_PLACEMENT, unique=True)
    rank: Rank
    ascension: Ascension
