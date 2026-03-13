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
#    ACCESS_TOKEN_EXPIRE_MINUTES=60

# 3. front.env
#    NEXTAUTH_SECRET=<npx auth secret>
#    NEXTAUTH_URL=https://www.your-domain.com
#    NEXTAUTH_URL_INTERNAL=http://front:3000
#    DISCORD_CLIENT_ID=<from Discord Developer Portal>
#    DISCORD_CLIENT_SECRET=<from Discord Developer Portal>

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────
# Domain DNS attendu:
# - your-domain.com     -> IP du serveur
# - www.your-domain.com -> IP du serveur
#
# docker compose -f compose-prod.yaml up -d
#
# Caddy génère automatiquement les certificats Let's Encrypt
# quand le domaine public pointe bien vers votre serveur.
#
# Le bloc Caddy recommandé:
# - redirige l'apex vers https://www.your-domain.com
# - sert l'application uniquement sur https://www.your-domain.com
#
# Les certificats sont stockés dans le volume Docker `caddy_data`
# sous /data/caddy/certificates à l'intérieur du conteneur.
#
# For IP-only / no TLS (temporary):
# utiliser un Caddyfile temporaire dédié, sans domaine public.
