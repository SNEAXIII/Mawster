"""rename_login_log_id_user

Revision ID: 2c5d182ad585
Revises: c4a1f0b93de7
Create Date: 2026-08-27 12:57:34.378126

"""

from collections.abc import Sequence

import sqlmodel  # noqa: F401
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "2c5d182ad585"
down_revision: str | None = "c4a1f0b93de7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Autogenerate read this as a drop plus an add, which would throw away every login
    # record; alter_column renames in place and the FK follows the column.
    op.alter_column(
        "login_log",
        "id_user",
        new_column_name="user_id",
        existing_type=mysql.CHAR(length=32),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "login_log",
        "user_id",
        new_column_name="id_user",
        existing_type=mysql.CHAR(length=32),
        existing_nullable=False,
    )
