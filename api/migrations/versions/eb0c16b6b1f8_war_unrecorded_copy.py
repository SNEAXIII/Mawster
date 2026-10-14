"""war_unrecorded_copy

Revision ID: eb0c16b6b1f8
Revises: 5e38bbb2c3fe
Create Date: 2026-10-15 00:25:53.206763

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "eb0c16b6b1f8"
down_revision: str | None = "5e38bbb2c3fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TABLES = {
    "war_synergy_attacker": (
        "uq_war_synergy_champion",
        ["war_id", "battlegroup", "game_account_id", "champion_id"],
        ["war_id", "battlegroup", "champion_user_id"],
    ),
    "war_prefight_attacker": (
        "uq_war_prefight_champion_node",
        ["war_id", "battlegroup", "game_account_id", "champion_id", "target_node_number"],
        ["war_id", "battlegroup", "champion_user_id", "target_node_number"],
    ),
}


def _swap_unique(table: str, name: str, cols: list[str]) -> None:
    # The old unique backs the war_id FK on MariaDB: keep a stand-in index while swapping.
    op.create_index("ix_tmp_war_id", table, ["war_id"])
    op.drop_constraint(name, table, type_="unique")
    op.create_unique_constraint(name, table, cols)
    op.drop_index("ix_tmp_war_id", table_name=table)


def upgrade() -> None:
    """Upgrade schema."""
    for table, (name, new_cols, _) in _TABLES.items():
        op.add_column(table, sa.Column("champion_id", sa.Uuid(), nullable=True))
        op.execute(
            f"UPDATE {table} SET champion_id = "  # noqa: S608
            f"(SELECT champion_user.champion_id FROM champion_user "
            f"WHERE champion_user.id = {table}.champion_user_id)"
        )
        op.alter_column(table, "champion_id", existing_type=sa.Uuid(), nullable=False)
        op.create_foreign_key(f"fk_{table}_champion_id", table, "champion", ["champion_id"], ["id"])
        op.alter_column(
            table, "champion_user_id", existing_type=mysql.CHAR(length=32), nullable=True
        )
        _swap_unique(table, name, new_cols)


def downgrade() -> None:
    """Downgrade schema."""
    for table, (name, _, old_cols) in _TABLES.items():
        op.execute(f"DELETE FROM {table} WHERE champion_user_id IS NULL")  # noqa: S608
        _swap_unique(table, name, old_cols)
        op.alter_column(
            table, "champion_user_id", existing_type=mysql.CHAR(length=32), nullable=False
        )
        op.drop_constraint(f"fk_{table}_champion_id", table, type_="foreignkey")
        op.drop_column(table, "champion_id")
