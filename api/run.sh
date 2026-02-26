set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict
export MODE="prod"
uv run --no-sync alembic upgrade head
uv run --no-sync fastapi run