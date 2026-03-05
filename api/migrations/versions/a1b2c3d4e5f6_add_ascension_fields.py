"""add ascension fields

Revision ID: a1b2c3d4e5f6
Revises: fbe57aabf75d
Create Date: 2026-03-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fbe57aabf75d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_ascendable to champion and ascension to champion_user."""
    op.add_column('champion', sa.Column('is_ascendable', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('champion_user', sa.Column('ascension', sa.Integer(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    """Remove ascension columns."""
    op.drop_column('champion_user', 'ascension')
    op.drop_column('champion', 'is_ascendable')
