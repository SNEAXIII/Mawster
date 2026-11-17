"""typed_requested_rarity

Revision ID: 3d1c7a9f2e10
Revises: 2c5d182ad585
Create Date: 2026-09-03 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3d1c7a9f2e10"
down_revision: str | None = "2c5d182ad585"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# "7r3" was stored as free text; stars and rank are integers everywhere else.
# Backfill parses the code, falling back on 7r1 for anything unparseable (nothing
# else could have passed the API, but the column allowed it).
_BACKFILL = sa.text(
    """
    UPDATE requested_upgrade
    SET requested_stars = CASE
            WHEN LOWER(requested_rarity) REGEXP '^[67]r[1-6]$'
            THEN CAST(SUBSTRING(requested_rarity, 1, 1) AS UNSIGNED)
            ELSE 7
        END,
        requested_rank = CASE
            WHEN LOWER(requested_rarity) REGEXP '^[67]r[1-6]$'
            THEN CAST(SUBSTRING(requested_rarity, 3, 1) AS UNSIGNED)
            ELSE 1
        END
    """
)

_RESTORE = sa.text(
    """
    UPDATE requested_upgrade
    SET requested_rarity = CONCAT(requested_stars, 'r', requested_rank)
    """
)


def upgrade() -> None:
    """Upgrade schema."""
    # Added NOT NULL with a placeholder default rather than nullable-then-tightened:
    # dropping a default is metadata-only, where flipping a column to NOT NULL rebuilds
    # the table (and fails outright on the Windows bind-mounted dev volume).
    op.add_column(
        "requested_upgrade",
        sa.Column("requested_stars", sa.Integer(), nullable=False, server_default="7"),
    )
    op.add_column(
        "requested_upgrade",
        sa.Column("requested_rank", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute(_BACKFILL)
    op.alter_column("requested_upgrade", "requested_stars", server_default=None)
    op.alter_column("requested_upgrade", "requested_rank", server_default=None)
    op.drop_column("requested_upgrade", "requested_rarity")


def downgrade() -> None:
    """Downgrade schema.

    Rebuilds the code from the pair, so a row that came in as "7R3" or as junk comes
    back normalised ("7r3", "7r1") — the point of the typed columns.
    """
    op.add_column(
        "requested_upgrade",
        sa.Column(
            "requested_rarity",
            sqlmodel.sql.sqltypes.AutoString(length=10),
            nullable=False,
            server_default="7r1",
        ),
    )
    op.execute(_RESTORE)
    op.alter_column("requested_upgrade", "requested_rarity", server_default=None)
    op.drop_column("requested_upgrade", "requested_rank")
    op.drop_column("requested_upgrade", "requested_stars")
