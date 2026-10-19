import sqlalchemy as sa

from src.models.Base import Battlegroup, UUIDBase, WarFk


class WarReadyBattlegroup(UUIDBase, WarFk, table=True):
    """A Battlegroup a Strategist declared Ready in one War; no row means not Ready."""

    __tablename__ = "war_ready_battlegroup"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "battlegroup", name="uq_war_ready_battlegroup"),
    )

    battlegroup: Battlegroup
