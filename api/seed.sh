set -e

# Runs the champion/mastery catalogue loaders inside an already-running api
# container (see `make seed-champions` / `seed-champions-staging` in the root
# Makefile, which docker exec into a live api task and invoke this script).
#
# Why this script exists: the loaders import src.security.secrets, whose
# Settings requires MARIADB_PASSWORD, SECRET_KEY, EMAIL_PEPPER, RABBITMQ_URL,
# RUSTFS_ACCESS_KEY and RUSTFS_SECRET_KEY in MODE=prod. run.sh exports those
# at runtime inside PID 1, but `docker exec` spawns a fresh process that does
# NOT inherit PID 1's runtime exports - it only sees the container's static
# launch environment. Without this script, the loaders crash on import with a
# pydantic ValidationError before touching the database. Mirrors run.sh's
# exports exactly, minus the ones the loaders don't need.
#
# No wait-for-it.sh here (unlike run.sh): this only ever runs inside a
# container that is already serving traffic, so the database is already up.
export SECRET_KEY="${SECRET_KEY:-$(cat /run/secrets/mawster_secret_key)}"
export MARIADB_PASSWORD="${MARIADB_PASSWORD:-$(cat /run/secrets/mawster_db_password)}"
export EMAIL_PEPPER="${EMAIL_PEPPER:-$(cat /run/secrets/mawster_email_pepper)}"

# Vision: broker URL + object-store keys. RABBITMQ_URL / RUSTFS_ACCESS_KEY /
# RUSTFS_SECRET_KEY are required in prod (secrets.py Field(...)), so Settings()
# won't build without them - same reasoning as run.sh.
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://mawster:$(cat /run/secrets/mawster_rabbitmq_pass)@rabbitmq:5672/}"
export RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-$(cat /run/secrets/mawster_rustfs_access_key)}"
export RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-$(cat /run/secrets/mawster_rustfs_secret_key)}"

# set -e stops here if load_champions fails, so load_masteries never runs
# against a half-seeded catalogue.
uv run --no-sync python -m src.fixtures.load_champions
uv run --no-sync python -m src.fixtures.load_masteries
