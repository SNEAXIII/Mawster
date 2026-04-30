"""add is_combat_completed to war_defense_placement

Revision ID: a3f1c9e2b4d8
Revises: 178b878847d9
Create Date: 2026-04-30 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "a3f1c9e2b4d8"
down_revision: Union[str, None] = "178b878847d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "war_defense_placement",
        sa.Column("is_combat_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("war_defense_placement", "is_combat_completed")
