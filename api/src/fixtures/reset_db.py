from time import sleep

import pymysql

import src.models  # noqa: F401
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from src.fixtures import sync_engine as engine

alembic_cfg = Config("alembic.ini")


def reset_attempt():
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
    print("✅ Database reset with success !")
    print("🚀 Start migration")
    command.upgrade(alembic_cfg, "head")
    print("✅ Migration with success !")


def reset(number_of_attempts=7):
    print("🚀 Resetting database")
    for attempt in range(number_of_attempts):
        try:
            reset_attempt()
            return
        except Exception as e:
            print(f"❌ Attempt {attempt + 1} failed: {e}")
            sleep(attempt + 1)
    raise pymysql.err.OperationalError(
        f"Failed to reset database after {number_of_attempts} attempts"
    )


if __name__ == "__main__":
    reset()
