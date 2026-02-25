# ──────────────────────────────────────────────
# Production env files — copy and fill in values
# ──────────────────────────────────────────────

# 1. db.env  (already exists — update passwords)
#    MARIADB_USER=mawster
#    MARIADB_PASSWORD=<STRONG_PASSWORD>
#    MARIADB_ROOT_PASSWORD=<STRONG_ROOT_PASSWORD>
#    MARIADB_PORT=3306
#    MARIADB_DATABASE=mawster

# 2. api.env
#    SECRET_KEY=<openssl rand -hex 64>
#    MARIADB_USER=mawster
#    MARIADB_PASSWORD=<same as db.env>
#    MARIADB_ROOT_PASSWORD=<same as db.env>
#    MARIADB_PORT=3306
#    MARIADB_DATABASE=mawster
#    ALGORITHM=HS256
#    BCRYPT_HASH_ROUND=12
#    ACCESS_TOKEN_EXPIRE_MINUTES=60

# 3. front.env
#    NEXTAUTH_SECRET=<npx auth secret>
#    NEXTAUTH_URL=https://your-domain.com
#    DISCORD_CLIENT_ID=<from Discord Developer Portal>
#    DISCORD_CLIENT_SECRET=<from Discord Developer Portal>

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────
# export DOMAIN=your-domain.com
# docker compose -f compose.prod.yaml up -d
#
# Caddy auto-provisions HTTPS via Let's Encrypt
# when DOMAIN is a real domain pointing to your server.
#
# For IP-only / no TLS (temporary):
# export DOMAIN=:80
# docker compose -f compose.prod.yaml up -d
