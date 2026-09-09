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
    # Create before drop: the FK to user needs a covering index at all times, and
    # MariaDB refuses to drop the last one (errno 1553).
    op.create_index(op.f(new), TABLE, ["user_id"], unique=False)
    op.drop_index(op.f(old), table_name=TABLE)


def upgrade() -> None:
    """Upgrade schema."""
    # Only bases migrated under the older engine carry `id_user`: 2c5d182ad585 renamed
    # the column, and MariaDB 11.4 now renames the FK index along with it.
    if "id_user" in _index_names():
        _rename_index("id_user", "user_id")


def downgrade() -> None:
    """Downgrade schema."""
    if "id_user" not in _index_names():
        _rename_index("user_id", "id_user")
