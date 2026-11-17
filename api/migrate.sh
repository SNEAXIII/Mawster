#!/usr/bin/env sh
set -e

if [[ -f /run/secrets/mawster_db_password ]]; then
  export POSTGRES_PASSWORD=$(cat /run/secrets/mawster_db_password)
fi

export POSTGRES_USER=mawster
export POSTGRES_DB=mawster

uv run --no-build --no-sync alembic upgrade head