set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict

export SECRET_KEY="${SECRET_KEY:-$(cat /run/secrets/mawster_secret_key)}"
export MARIADB_PASSWORD="${MARIADB_PASSWORD:-$(cat /run/secrets/mawster_db_password)}"
export EMAIL_PEPPER="${EMAIL_PEPPER:-$(cat /run/secrets/mawster_email_pepper)}"

# Vision: broker URL + object-store keys. RABBITMQ_URL / RUSTFS_ACCESS_KEY /
# RUSTFS_SECRET_KEY are required in prod (secrets.py Field(...)), so the API
# won't boot without them.
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://mawster:$(cat /run/secrets/mawster_rabbitmq_pass)@rabbitmq:5672/}"
export RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-$(cat /run/secrets/mawster_rustfs_access_key)}"
export RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-$(cat /run/secrets/mawster_rustfs_secret_key)}"

uv run --no-sync fastapi run --port "${API_PORT:-8000}"
