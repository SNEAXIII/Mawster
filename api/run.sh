set -e

uv run --no-sync fastapi run --port "${API_PORT:-8000}"
