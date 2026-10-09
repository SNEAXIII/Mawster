set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict

. ./env.sh

uv run --no-sync fastapi run --port "${API_PORT:-8000}"
