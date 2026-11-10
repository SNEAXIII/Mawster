from alembic import command
from alembic.config import Config
from sqlalchemy import text

import src.models  # noqa: F401
from src.fixtures import sync_engine as engine

alembic_cfg = Config("alembic.ini")


def reset_attempt():
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    print("✅ Database reset with success !")
    print("🚀 Start migration")
    command.upgrade(alembic_cfg, "head")
    print("✅ Migration with success !")


def reset():
    print("🚀 Resetting database")
    reset_attempt()


if __name__ == "__main__":
    reset()
