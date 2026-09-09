"""rename_is_7_star_to_is_7_stars_available

Revision ID: a073de079c8d
Revises: 21d703c984fe
Create Date: 2026-09-09 07:38:23.676676

"""

from collections.abc import Sequence

import sqlmodel  # noqa: F401
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "a073de079c8d"
down_revision: str | None = "21d703c984fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "champion",
        "is_7_star",
        new_column_name="is_7_stars_available",
        existing_type=mysql.TINYINT(display_width=1),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "champion",
        "is_7_stars_available",
        new_column_name="is_7_star",
        existing_type=mysql.TINYINT(display_width=1),
        existing_nullable=False,
    )
