"""delete_pre_2_0_vision_predictions

Revision ID: 2a7e9ec80333
Revises: 14c078718005
Create Date: 2026-11-09 19:52:50.591278

"""
from typing import Sequence, Union

from alembic import op
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '2a7e9ec80333'
down_revision: Union[str, None] = '14c078718005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The 2.0 deploy finished at 00:17:45 UTC: jobs before it were read by the old
# worker, whose confidence is a CLIP score, not the mosaic margin the KPIs rank.
CUTOFF = "2026-11-08 00:18:00"

# Finished imports only: one still awaiting review keeps its cards to confirm.
_DELETE = f"""
DELETE FROM vision_prediction
WHERE job_id IN (
    SELECT j.id FROM vision_job j
    JOIN vision_import i ON i.id = j.import_id
    WHERE j.created_at < '{CUTOFF}'
      AND i.status IN ('CONFIRMED', 'CANCELLED', 'FAILED')
)
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(_DELETE)


def downgrade() -> None:
    """Downgrade schema."""
    # Irreversible: the deleted readings are gone.
