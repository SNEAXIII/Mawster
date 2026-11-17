"""switch_champion_images_to_webp

Revision ID: 5e38bbb2c3fe
Revises: 797935c1dcc1
Create Date: 2026-10-06 20:38:51.300603

"""

from collections.abc import Sequence

import sqlmodel  # noqa: F401
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e38bbb2c3fe"
down_revision: str | None = "797935c1dcc1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "UPDATE champion SET image_url = CONCAT(LEFT(image_url, CHAR_LENGTH(image_url) - 4), '.webp') "
        "WHERE image_url LIKE '%.png'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "UPDATE champion SET image_url = CONCAT(LEFT(image_url, CHAR_LENGTH(image_url) - 5), '.png') "
        "WHERE image_url LIKE '%.webp'"
    )
