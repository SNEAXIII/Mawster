from time import sleep

from sqlalchemy import text

import src.models  # noqa: F401
from src.fixtures import sync_engine as engine


def delete_attempt():
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    print("✅ Database emptied: public schema recreated empty, tables NOT recreated.")


def delete(number_of_attempts=7):
    print("🗑️  Deleting all tables")
    for attempt in range(number_of_attempts):
        try:
            delete_attempt()
            return
        except Exception as e:
            print(f"❌ Attempt {attempt + 1} failed: {e}")
            sleep(attempt + 1)
    msg = f"Failed to delete database after {number_of_attempts} attempts"
    raise RuntimeError(msg)


if __name__ == "__main__":
    delete()
