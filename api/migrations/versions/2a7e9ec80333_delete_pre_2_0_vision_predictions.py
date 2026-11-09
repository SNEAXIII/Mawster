"""delete_pre_2_0_vision_predictions

Revision ID: 2a7e9ec80333
Revises: 14c078718005
Create Date: 2026-11-09 19:52:50.591278

"""

from collections.abc import Sequence

import sqlmodel  # noqa: F401
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a7e9ec80333"
down_revision: str | None = "14c078718005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Jobs before the 2.0 deploy (00:17:45 UTC) carry a CLIP score, not the mosaic margin.
# Finished imports only: one still awaiting review keeps its cards to confirm.
_DELETE = """
DELETE FROM vision_prediction
WHERE job_id IN (
    SELECT j.id FROM vision_job j
    JOIN vision_import i ON i.id = j.import_id
    WHERE j.created_at < '2026-11-08 00:18:00'
      AND i.status IN ('CONFIRMED', 'CANCELLED', 'FAILED')
)
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(_DELETE)


def downgrade() -> None:
    """Downgrade schema."""
    # Irreversible: the deleted readings are gone.
