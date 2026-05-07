"""add_fight_flags

Revision ID: afb4119fc6b6
Revises: 845077a610bf
Create Date: 2026-05-05 23:27:50.009064

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'afb4119fc6b6'
down_revision: Union[str, None] = '845077a610bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('war_defense_placement', sa.Column('is_fight_not_done', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('war_defense_placement', sa.Column('is_planning_error', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('war_fight_record', sa.Column('is_planning_error', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('war_fight_record', 'is_planning_error')
    op.drop_column('war_defense_placement', 'is_planning_error')
    op.drop_column('war_defense_placement', 'is_fight_not_done')
