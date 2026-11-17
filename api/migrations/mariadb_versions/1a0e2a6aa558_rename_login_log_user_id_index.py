"""rename_login_log_user_id_index

Revision ID: 1a0e2a6aa558
Revises: a073de079c8d
Create Date: 2026-09-09 07:43:51.227346

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1a0e2a6aa558"
down_revision: str | None = "a073de079c8d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "login_log"


def _index_names() -> set[str]:
    return {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(TABLE)}


def _rename_index(old: str, new: str) -> None:
    # RENAME INDEX, not create-then-drop: creating a second index on the FK column makes
    # InnoDB silently drop the now-redundant implicit one, and the drop then fails.
    op.execute(f"ALTER TABLE {TABLE} RENAME INDEX {old} TO {new}")


def upgrade() -> None:
    """Upgrade schema."""
    if "id_user" in _index_names():
        _rename_index("id_user", "user_id")


def downgrade() -> None:
    """Downgrade schema."""
    if "id_user" not in _index_names():
        _rename_index("user_id", "id_user")
