"""war_synergy_attacker

Revision ID: a1b2c3d4e5f6
Revises: f9e052192b3a
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f9e052192b3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'war_synergy_attacker',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('war_id', sa.Uuid(), nullable=False),
        sa.Column('battlegroup', sa.Integer(), nullable=False),
        sa.Column('game_account_id', sa.Uuid(), nullable=False),
        sa.Column('champion_user_id', sa.Uuid(), nullable=False),
        sa.Column('target_champion_user_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['champion_user_id'], ['champion_user.id']),
        sa.ForeignKeyConstraint(['game_account_id'], ['game_account.id']),
        sa.ForeignKeyConstraint(['target_champion_user_id'], ['champion_user.id']),
        sa.ForeignKeyConstraint(['war_id'], ['war.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('war_id', 'battlegroup', 'champion_user_id', name='uq_war_synergy_champion'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('war_synergy_attacker')
