#!/usr/bin/env sh
set -e
export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
uv run --no-sync alembic upgrade head
