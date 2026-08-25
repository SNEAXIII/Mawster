"""alliance_soft_delete

Revision ID: c4a1f0b93de7
Revises: 44ec4546df6d
Create Date: 2026-08-25 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4a1f0b93de7"
down_revision: str | None = "44ec4546df6d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable on purpose: NULL is "alive", a timestamp is "disbanded" — the same
    # contract as user.deleted_at, so existing alliances need no backfill.
    op.add_column("alliance", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("alliance", "deleted_at")
