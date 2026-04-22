#!/usr/bin/env sh
set -e

if [ -f /run/secrets/mawster_db_password ]; then
  export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
fi
if [ -f /run/secrets/mawster_db_root_password ]; then
  export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
fi

export MARIADB_USER=mawster
export MARIADB_DATABASE=mawster

uv run --no-sync alembic upgrade head