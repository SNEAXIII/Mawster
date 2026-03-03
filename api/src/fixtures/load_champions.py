"""
Champion fixture script.
Loads champions from champions.json into the database.

JSON format expected (array of objects):
    [
      {
        "name": "Spider-Man (Classic)",
        "champion_class": "Science",
        "image_url": "/static/champions/spider-man_classic.png",
        "alias": null
      },
      ...
    ]

Usage:
    make load-champions
    # or
    python -m src.fixtures.load_champions
    python -m src.fixtures.load_champions --json path/to/champions.json
"""

import json
import sys
from pathlib import Path

from sqlmodel import create_engine, Session, select

from src.models.Champion import Champion
from src.security.secrets import SECRET

sync_engine = create_engine(
    f"mysql+pymysql://{SECRET.MARIADB_USER}:{SECRET.MARIADB_PASSWORD}@{SECRET.MARIADB_HOST}/{SECRET.MARIADB_DATABASE}",
)

DEFAULT_JSON_PATH = Path(__file__).parent.parent.parent / "scripts" / "champions.json"


def load_champions(json_path: Path = DEFAULT_JSON_PATH):
    """Load champions from a JSON file into the database.

    Skips champions that already exist (matched by name).
    Updates alias/image_url if the champion already exists.
    """
    if not json_path.exists():
        print(f"❌ JSON file not found: {json_path}")
        print("   Expected: scripts/champions.json")
        return

    added = 0
    updated = 0
    skipped = 0

    try:
        with Session(sync_engine) as session:
            with open(json_path, encoding="utf-8") as f:
                champions_data = json.load(f)

            if not isinstance(champions_data, list):
                print("❌ JSON root must be an array of champion objects")
                return

            for item in champions_data:
                name = item.get("name", "").strip()
                if not name:
                    continue

                champion_class = item.get("champion_class", "").strip()
                image_url = item.get("image_url") or None
                alias = item.get("alias") or None

                # Check if champion already exists
                existing = session.exec(
                    select(Champion).where(Champion.name == name)
                ).first()

                if existing:
                    # Update fields if they changed
                    changed = False
                    if existing.image_url != image_url:
                        existing.image_url = image_url
                        changed = True
                    if existing.alias != alias:
                        existing.alias = alias
                        changed = True
                    if existing.champion_class != champion_class:
                        existing.champion_class = champion_class
                        changed = True
                    if changed:
                        session.add(existing)
                        updated += 1
                    else:
                        skipped += 1
                    continue

                champion = Champion(
                    name=name,
                    champion_class=champion_class,
                    image_url=image_url,
                    alias=alias,
                )
                session.add(champion)
                added += 1

            session.commit()

        print(f"✅ Champions loaded: {added} added, {updated} updated, {skipped} unchanged")

    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        raise
    except Exception as e:
        print(f"❌ Error loading champions: {e}")
        raise


if __name__ == "__main__":
    json_file = DEFAULT_JSON_PATH
    if len(sys.argv) > 2 and sys.argv[1] == "--json":
        json_file = Path(sys.argv[2])

    load_champions(json_file)
