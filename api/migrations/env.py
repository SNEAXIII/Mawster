import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

try:
    from src.security.secrets import SECRET
    _mariadb_user = SECRET.MARIADB_USER
    _mariadb_password = SECRET.MARIADB_PASSWORD
    _mariadb_host = SECRET.MARIADB_HOST
    _mariadb_port = str(SECRET.MARIADB_PORT)
    _mariadb_database = SECRET.MARIADB_DATABASE
except ImportError:
    _mariadb_user = os.environ["MARIADB_USER"]
    _mariadb_password = os.environ["MARIADB_PASSWORD"]
    _mariadb_host = os.environ.get("MARIADB_HOST", "mariadb")
    _mariadb_port = os.environ.get("MARIADB_PORT", "3306")
    _mariadb_database = os.environ["MARIADB_DATABASE"]

try:
    from src.models import SQLModel
    target_metadata = SQLModel.metadata
except ImportError:
    target_metadata = None

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
section = config.config_ini_section
config.set_section_option(section, "MARIADB_USER", _mariadb_user)
config.set_section_option(section, "MARIADB_PASSWORD", _mariadb_password)
config.set_section_option(section, "MARIADB_HOST", _mariadb_host)
config.set_section_option(section, "MARIADB_PORT", _mariadb_port)
config.set_section_option(section, "MARIADB_DATABASE", _mariadb_database)

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
