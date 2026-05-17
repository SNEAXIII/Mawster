# Deploy — Mawster

Production stack: **Docker Swarm + Traefik v3 + Let's Encrypt**.

## Prerequisites

- Docker Swarm initialized (`docker swarm init`)
- External networks created:
  ```bash
  docker network create --driver overlay --attachable traefik-public
  docker network create --driver overlay --attachable internal
  ```
- DNS: `mawster.app` and `www.mawster.app` pointing to the server IP

## Secrets

All secrets are managed via Docker Swarm secrets. Create each one:

```bash
echo "<value>" | docker secret create mawster_secret_key -
echo "<value>" | docker secret create mawster_db_password -
echo "<value>" | docker secret create mawster_db_root_password -
echo "<value>" | docker secret create mawster_email_pepper -
echo "<value>" | docker secret create mawster_nextauth_secret -
echo "<value>" | docker secret create mawster_discord_client_id -
echo "<value>" | docker secret create mawster_discord_client_secret -
echo "<value>" | docker secret create mawster_google_client_id -
echo "<value>" | docker secret create mawster_google_client_secret -
cat rclone.conf | docker secret create mawster_rclone_conf -
```

| Secret | How to generate |
|---|---|
| `mawster_secret_key` | `openssl rand -hex 64` |
| `mawster_db_password` | strong random password |
| `mawster_db_root_password` | strong random password |
| `mawster_email_pepper` | `openssl rand -hex 32` |
| `mawster_nextauth_secret` | `npx auth secret` |
| `mawster_discord_client_id/secret` | Discord Developer Portal |
| `mawster_google_client_id/secret` | Google Cloud Console |
| `mawster_rclone_conf` | `rclone config` then copy `~/.config/rclone/rclone.conf` |

## Deploy

```bash
docker stack deploy -c stack-app.yaml mawster
```

Traefik requests Let's Encrypt certificates automatically once DNS is set.

## Observability (optional)

```bash
docker stack deploy -c stack-obs.yaml mawster-obs
```

## Update

```bash
docker pull sneaxiii/mawster-api:latest
docker pull sneaxiii/mawster-front:latest
docker pull sneaxiii/mawster-static:latest
docker stack deploy -c stack-app.yaml mawster
```

Swarm rolling update: 1 replica at a time, 10s delay, rollback on failure.

## Backups

The `backup` service runs automatically and syncs via rclone to the configured remote.
Local dumps are stored in `/root/Mawster/backups` on the manager node.
