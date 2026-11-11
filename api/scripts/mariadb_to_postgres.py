"""One-shot copy of the MariaDB data into a freshly migrated, empty PostgreSQL.

Usage, from api/: uv run python scripts/mariadb_to_postgres.py <source_url> <target_url>
  source: mysql+pymysql://user:pass@host:3306/mawster
  target: postgresql+psycopg://user:pass@host:5432/mawster
"""

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy import and_, create_engine, exists, func, inspect, select, text  # noqa: E402

from src.models import SQLModel  # noqa: E402

BATCH = 5000


def count(conn, table) -> int:
    return conn.execute(select(func.count()).select_from(table)).scalar_one()


def main(source_url: str, target_url: str) -> None:
    head = ScriptDirectory(str(API_DIR / "migrations")).get_current_head()
    tables = SQLModel.metadata.sorted_tables
    with create_engine(source_url).connect() as src, create_engine(target_url).begin() as tgt:
        if not inspect(tgt).has_table("alembic_version"):
            sys.exit(f"Refused: the target has no alembic_version, migrate it to {head} first.")
        version = tgt.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if version != head:
            sys.exit(f"Refused: the target is at {version}, not at the head {head}.")
        filled = [t.name for t in tables if tgt.execute(select(exists().select_from(t))).scalar()]
        if filled:
            sys.exit(f"Refused: the target already holds data in {', '.join(filled)}.")

        # alliance.owner_id <-> game_account is a cycle: FK triggers stay off during the copy,
        # the orphan check below stands in for them.
        tgt.execute(text("SET LOCAL session_replication_role = replica"))
        for table in tables:
            result = src.execution_options(yield_per=BATCH).execute(select(table))
            for rows in result.partitions():
                tgt.execute(table.insert(), [r._mapping for r in rows])

        for table in tables:
            for fk in table.foreign_key_constraints:
                parent = fk.referred_table.alias()
                pairs = [(e.parent, parent.c[e.column.name]) for e in fk.elements]
                orphans = tgt.execute(
                    select(func.count())
                    .select_from(table)
                    .where(and_(*(c.is_not(None) for c, _ in pairs)))
                    .where(~exists().where(and_(*(p == c for c, p in pairs))).select_from(parent))
                ).scalar_one()
                if orphans:
                    cols = ", ".join(c.name for c, _ in pairs)
                    sys.exit(
                        f"Rolled back: {orphans} {table.name}.{cols} point to no {fk.referred_table.name}."
                    )

        for table in tables:
            source, target = count(src, table), count(tgt, table)
            print(f"{table.name:<28} {source:>8} / {target:<8}")
            if source != target:
                sys.exit(f"Rolled back: {table.name} counts differ.")
    print("Committed.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
