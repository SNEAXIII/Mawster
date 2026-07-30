"""add_reranked_to_vision_prediction

Revision ID: 2bddb8e3af0c
Revises: 98888a52433b
Create Date: 2026-07-30 23:54:20.606990

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2bddb8e3af0c"
down_revision: str | None = "98888a52433b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default so the existing rows get a defined value instead of the
    # engine's implicit one: every prediction written before the pixel second
    # pass existed was, by definition, not reranked.
    op.add_column(
        "vision_prediction",
        sa.Column("reranked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("vision_prediction", "reranked")
