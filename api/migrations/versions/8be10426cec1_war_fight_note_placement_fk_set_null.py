"""war_fight_note_placement_fk_set_null

Revision ID: 8be10426cec1
Revises: f1e8de91f46f
Create Date: 2026-07-15 15:18:54.860027

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "8be10426cec1"
down_revision: Union[str, None] = "f1e8de91f46f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _placement_fk_name() -> str:
    """Resolve the FK constraint name at runtime: MariaDB auto-names it
    (`war_fight_note_ibfk_N` in prod/dev, a bare number on freshly-built DBs),
    so it is not portable across environments and must be looked up."""
    conn = op.get_bind()
    name = conn.execute(
        sa.text(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'war_fight_note' "
            "AND COLUMN_NAME = 'war_defense_placement_id' "
            "AND REFERENCED_TABLE_NAME = 'war_defense_placement'"
        )
    ).scalar_one()
    return name


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(_placement_fk_name(), "war_fight_note", type_="foreignkey")
    op.alter_column(
        "war_fight_note",
        "war_defense_placement_id",
        existing_type=mysql.CHAR(length=32),
        nullable=True,
    )
    op.create_foreign_key(
        None,
        "war_fight_note",
        "war_defense_placement",
        ["war_defense_placement_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(_placement_fk_name(), "war_fight_note", type_="foreignkey")
    op.alter_column(
        "war_fight_note",
        "war_defense_placement_id",
        existing_type=mysql.CHAR(length=32),
        nullable=False,
    )
    op.create_foreign_key(
        None, "war_fight_note", "war_defense_placement", ["war_defense_placement_id"], ["id"]
    )
