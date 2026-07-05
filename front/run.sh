set -e
/bin/bash ./wait-for-it.sh api:8000 -t 60 --strict

export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(cat /run/secrets/mawster_nextauth_secret)}"
export DISCORD_CLIENT_ID="${DISCORD_CLIENT_ID:-$(cat /run/secrets/mawster_discord_client_id)}"
export DISCORD_CLIENT_SECRET="${DISCORD_CLIENT_SECRET:-$(cat /run/secrets/mawster_discord_client_secret)}"
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-$(cat /run/secrets/mawster_google_client_id)}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-$(cat /run/secrets/mawster_google_client_secret)}"

# NEXT_PUBLIC_* is inlined at build time. We build with a placeholder host and
# rewrite it here so the SAME image works for prod and staging.
: "${NEXT_PUBLIC_API_CLIENT_HOST:?NEXT_PUBLIC_API_CLIENT_HOST is required}"
find .next -type f -name '*.js' \
  -exec sed -i "s|__NEXT_PUBLIC_API_HOST__|${NEXT_PUBLIC_API_CLIENT_HOST}|g" {} +

node server.js
