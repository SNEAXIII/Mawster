"""
mastery fixture script.
Loads masteries from masteries.json into the database.

Usage:
    make load-masteries
    # or
    python -m src.fixtures.load_masteries
    python -m src.fixtures.load_masteries --json path/to/masteries.json
"""

import json
import sys
from pathlib import Path

from sqlmodel import create_engine, Session, select

from src.models.Mastery import Mastery
from src.security.secrets import SECRET

sync_engine = create_engine(
    f"mysql+pymysql://{SECRET.MARIADB_USER}:{SECRET.MARIADB_PASSWORD}@{SECRET.MARIADB_HOST}:{SECRET.MARIADB_PORT}/{SECRET.MARIADB_DATABASE}",
)

DEFAULT_JSON_PATH = Path(__file__).parent.parent.parent / "scripts" / "masteries.json"


def _update_existing_mastery(
    session: Session, existing: Mastery, max_value: int, order: int
) -> bool:
    """Update an existing mastery's fields if they changed. Returns True if updated."""
    changed = False
    if existing.max_value != max_value:
        existing.max_value = max_value
        changed = True
    if existing.order != order:
        existing.order = order
        changed = True
    if changed:
        session.add(existing)
    return changed


def _process_mastery_item(session: Session, item: dict) -> str:
    """Process a single mastery item. Returns 'added', 'updated', or 'skipped'."""
    name: str = item.get("name", "").strip()
    max_value: int = item.get("max_value", 0)
    order: None | int = item.get("order", None)

    if not name or max_value == 0 or order is None:
        return "skipped"

    existing: Mastery | None = session.exec(select(Mastery).where(Mastery.name == name)).first()

    if existing:
        return (
            "updated"
            if _update_existing_mastery(session, existing, max_value, order)
            else "skipped"
        )

    mastery = Mastery(
        name=name,
        max_value=max_value,
        order=order,
    )
    session.add(mastery)
    return "added"


def load_masteries(json_path: Path = DEFAULT_JSON_PATH):
    """Load masteries from a JSON file into the database.

    Skips masteries that already exist (matched by name).
    Updates alias/image_url if the mastery already exists.
    """
    if not json_path.exists():
        print(f"❌ JSON file not found: {json_path}")
        print("   Expected: scripts/masteries.json")
        return

    added = 0
    updated = 0
    skipped = 0

    try:
        with Session(sync_engine) as session:
            with open(json_path, encoding="utf-8") as f:
                masteries_data = json.load(f)

            if not isinstance(masteries_data, list):
                print("❌ JSON root must be an array of mastery objects")
                return

            for item in masteries_data:
                result = _process_mastery_item(session, item)
                if result == "added":
                    added += 1
                elif result == "updated":
                    updated += 1
                else:
                    skipped += 1

            session.commit()

        print(f"✅ masteries loaded: {added} added, {updated} updated, {skipped} unchanged")

    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        raise
    except Exception as e:
        print(f"❌ Error loading masteries: {e}")
        raise


if __name__ == "__main__":
    json_file = DEFAULT_JSON_PATH
    if len(sys.argv) > 2 and sys.argv[1] == "--json":
        json_file = Path(sys.argv[2])

    load_masteries(json_file)
