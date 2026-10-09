set -e

# Runs the champion/mastery catalogue loaders inside an already-running api
# container (`make seed-champions`, also run by the production deploy).
# No wait-for-it.sh here (unlike run.sh): the database is already up.
. ./env.sh

# set -e stops here if load_champions fails, so load_masteries never runs
# against a half-seeded catalogue.
uv run --no-build --no-sync python -m src.fixtures.load_champions
uv run --no-build --no-sync python -m src.fixtures.load_masteries
