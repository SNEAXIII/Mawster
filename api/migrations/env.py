import os
from logging.config import fileConfig

import alembic_postgresql_enum  # noqa: F401
from alembic import context
from sqlalchemy import engine_from_config, pool

try:
    from src.security.secrets import SECRET

    _pg_user = SECRET.POSTGRES_USER
    _pg_password = SECRET.POSTGRES_PASSWORD
    _pg_host = SECRET.POSTGRES_HOST
    _pg_port = str(SECRET.POSTGRES_PORT)
    _pg_db = SECRET.POSTGRES_DB
except ImportError:
    _pg_user = os.environ["POSTGRES_USER"]
    _pg_password = os.environ["POSTGRES_PASSWORD"]
    _pg_host = os.environ.get("POSTGRES_HOST", "postgres")
    _pg_port = os.environ.get("POSTGRES_PORT", "5432")
    _pg_db = os.environ["POSTGRES_DB"]

try:
    from src.models import SQLModel

    target_metadata = SQLModel.metadata
except ImportError:
    target_metadata = None

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
section = config.config_ini_section
config.set_section_option(section, "POSTGRES_USER", _pg_user)
config.set_section_option(section, "POSTGRES_PASSWORD", _pg_password)
config.set_section_option(section, "POSTGRES_HOST", _pg_host)
config.set_section_option(section, "POSTGRES_PORT", _pg_port)
config.set_section_option(section, "POSTGRES_DB", _pg_db)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        include_schemas=True,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
