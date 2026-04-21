set -e
/bin/bash ./wait-for-it.sh api:8000 -t 60 --strict

export NEXTAUTH_SECRET=$(cat /run/secrets/mawster_nextauth_secret)
export DISCORD_CLIENT_ID=$(cat /run/secrets/mawster_discord_client_id)
export DISCORD_CLIENT_SECRET=$(cat /run/secrets/mawster_discord_client_secret)

node server.js
