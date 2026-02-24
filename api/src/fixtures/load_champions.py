"""
Champion fixture script.
Loads champions from a CSV file into the database.

CSV format expected (with header):
    name,champion_class,image_url,is_7_star

Example:
    name,champion_class,image_url,is_7_star
    Spider-Man (Classic),Science,https://example.com/spiderman.png,False
    Doctor Doom,Mystic,https://example.com/doom.png,True

Usage:
    python -m src.fixtures.load_champions
    # or
    python -m src.fixtures.load_champions --csv path/to/champions.csv
"""

import csv
import sys
from pathlib import Path

from sqlmodel import create_engine, Session, select

from src.models.Champion import Champion
from src.security.secrets import SECRET

sync_engine = create_engine(
    f"mysql+pymysql://{SECRET.MARIADB_USER}:{SECRET.MARIADB_PASSWORD}@{SECRET.MARIADB_HOST}/{SECRET.MARIADB_DATABASE}",
)

DEFAULT_CSV_PATH = Path(__file__).parent / "champions.csv"


def parse_bool(value: str) -> bool:
    """Parse a boolean string value from CSV."""
    return value.strip().lower() in ("true", "1", "yes", "oui")


def load_champions(csv_path: Path = DEFAULT_CSV_PATH):
    """Load champions from a CSV file into the database.

    Skips champions that already exist (matched by name).
    """
    if not csv_path.exists():
        print(f"❌ CSV file not found: {csv_path}")
        print("   Please create the CSV file with columns: name,champion_class,image_url,is_7_star")
        return

    added = 0
    skipped = 0

    try:
        with Session(sync_engine) as session:
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)

                for row in reader:
                    name = row["name"].strip()

                    # Check if champion already exists
                    existing = session.exec(
                        select(Champion).where(Champion.name == name)
                    ).first()

                    if existing:
                        skipped += 1
                        continue

                    champion = Champion(
                        name=name,
                        champion_class=row["champion_class"].strip(),
                        image_url=row.get("image_url", "").strip() or None,
                        is_7_star=parse_bool(row.get("is_7_star", "false")),
                    )
                    session.add(champion)
                    added += 1

            session.commit()

        print(f"✅ Champions loaded: {added} added, {skipped} skipped (already exist)")

    except KeyError as e:
        print(f"❌ Missing column in CSV: {e}")
        print("   Expected columns: name, champion_class, image_url, is_7_star")
        raise
    except Exception as e:
        print(f"❌ Error loading champions: {e}")
        raise


if __name__ == "__main__":
    csv_file = DEFAULT_CSV_PATH
    if len(sys.argv) > 2 and sys.argv[1] == "--csv":
        csv_file = Path(sys.argv[2])

    load_champions(csv_file)
