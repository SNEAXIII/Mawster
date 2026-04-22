set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict

export SECRET_KEY=$(cat /run/secrets/mawster_secret_key)
export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
export EMAIL_PEPPER=$(cat /run/secrets/mawster_email_pepper)

uv run --no-sync fastapi run --port "${API_PORT:-8000}"
