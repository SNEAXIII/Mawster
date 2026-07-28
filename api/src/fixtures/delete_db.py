from time import sleep

import pymysql
from sqlalchemy import text

import src.models  # noqa: F401
from src.fixtures import sync_engine as engine


def delete_attempt():
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        result = conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()")
        )
        tables = [row[0] for row in result]
        for table in tables:
            conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        conn.commit()
    print(f"✅ Database emptied: dropped {len(tables)} table(s), schema NOT recreated.")


def delete(number_of_attempts=7):
    print("🗑️  Deleting all tables")
    for attempt in range(number_of_attempts):
        try:
            delete_attempt()
            return
        except Exception as e:
            print(f"❌ Attempt {attempt + 1} failed: {e}")
            sleep(attempt + 1)
    raise pymysql.err.OperationalError(
        f"Failed to delete database after {number_of_attempts} attempts"
    )


if __name__ == "__main__":
    delete()
