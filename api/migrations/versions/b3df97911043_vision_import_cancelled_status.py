"""vision_import_cancelled_status

Revision ID: b3df97911043
Revises: 06033433e335
Create Date: 2026-07-18 23:37:16.509897

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "b3df97911043"
down_revision: Union[str, None] = "06033433e335"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "vision_import",
        "status",
        existing_type=sa.Enum(
            "PENDING", "RUNNING", "DONE", "FAILED", "CONFIRMED", name="visionimportstatus"
        ),
        type_=sa.Enum(
            "PENDING",
            "RUNNING",
            "DONE",
            "FAILED",
            "CONFIRMED",
            "CANCELLED",
            name="visionimportstatus",
        ),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "vision_import",
        "status",
        existing_type=sa.Enum(
            "PENDING",
            "RUNNING",
            "DONE",
            "FAILED",
            "CONFIRMED",
            "CANCELLED",
            name="visionimportstatus",
        ),
        type_=sa.Enum(
            "PENDING", "RUNNING", "DONE", "FAILED", "CONFIRMED", name="visionimportstatus"
        ),
        existing_nullable=False,
    )
