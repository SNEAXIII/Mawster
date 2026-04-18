"""init

Revision ID: bc421804c873
Revises: 27f067e9cc5a
Create Date: 2026-04-17 21:54:09.500138

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'bc421804c873'
down_revision: Union[str, None] = '27f067e9cc5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'season',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('number', name='uq_season_number'),
    )
    op.add_column('war', sa.Column('season_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_war_season', 'war', 'season', ['season_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_war_season', 'war', type_='foreignkey')
    op.drop_column('war', 'season_id')
    op.drop_table('season')
