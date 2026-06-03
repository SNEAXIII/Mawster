"""season_status

Revision ID: 83f2948ec962
Revises: 26f1feb0c934
Create Date: 2026-06-03 20:38:21.471183

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "83f2948ec962"
down_revision: Union[str, None] = "26f1feb0c934"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add the column with a default so existing rows are valid, then backfill
    # from is_active (the previously active season -> active, others -> ended).
    op.add_column(
        "season",
        sa.Column(
            "status",
            sa.Enum("upcoming", "active", "ended", name="seasonstatus"),
            nullable=False,
            server_default="upcoming",
        ),
    )
    op.execute("UPDATE season SET status = 'active' WHERE is_active = 1")
    op.execute("UPDATE season SET status = 'ended' WHERE is_active = 0")
    op.drop_column("season", "is_active")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "season",
        sa.Column(
            "is_active",
            mysql.TINYINT(display_width=1),
            autoincrement=False,
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.execute("UPDATE season SET is_active = 1 WHERE status = 'active'")
    op.drop_column("season", "status")
