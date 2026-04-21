# Docker Swarm Migration Design

**Date:** 2026-04-21  
**Project:** Mawster  
**Status:** Approved

---

## Context

Mawster currently runs on a single VPS using Docker Compose (`compose-prod.yaml`) with 5 services: mariadb, backup, api, front, caddy. The CI builds Docker images and deploys via SSH with `docker compose up -d`.

**Motivations for migrating to Docker Swarm:**
- Zero-downtime rolling updates for api and front
- Docker secrets instead of plain `.env` files
- Replicas for api and front
- Better observability integration (Loki + Grafana + Prometheus)
- Replace Caddy with Traefik (native Prometheus metrics, Swarm service discovery)
- Learning Swarm

---

## Architecture

### Topology

Single-node Docker Swarm (manager = worker). Scalable to multi-node later with no design changes.

### Two stacks

| Stack | File | Deployed by |
|---|---|---|
| `mawster` (app) | `stack-app.yaml` | CI (on every release push) |
| `mawster-obs` (observability) | `stack-obs.yaml` | Manual (once, stable) |

### Networks (overlay)

| Network | Purpose |
|---|---|
| `traefik-public` | Traefik ↔ front, Traefik `/static/*` ↔ api, Prometheus ↔ Traefik |
| `internal` | api ↔ mariadb, backup ↔ mariadb, api ↔ front (internal calls) |
| `obs` | prometheus ↔ grafana ↔ loki ↔ promtail |

All overlay networks are `attachable: true` to allow one-shot containers (migration, restore).

---

## Stack App (`stack-app.yaml`)

### Services

| Service | Image | Replicas | Placement |
|---|---|---|---|
| `traefik` | `traefik:v3` | 1 | manager |
| `mariadb` | `mariadb:11.4` | 1 | manager (stateful) |
| `api` | `sneaxiii/mawster-api:latest` | 2 | any |
| `front` | `sneaxiii/mawster-front:latest` | 2 | any |
| `backup` | `sneaxiii/mawster-backup:latest` | 1 | manager (stateful) |

### Rolling update policy (api + front)

```yaml
update_config:
  parallelism: 1          # one replica at a time
  delay: 10s
  failure_action: rollback
  order: start-first      # new replica starts before old stops (zero downtime)
restart_policy:
  condition: on-failure
  delay: 5s
  max_attempts: 3
```

### Traefik

- Listens on ports 80 and 443
- Let's Encrypt TLS via ACME (HTTP challenge)
- Exposes Prometheus metrics on port 8082 (internal, not public)
- Routes:
  - `www.mawster.app` → `front:3000` (all paths except `/static/*`)
  - `www.mawster.app/static/*` → `api:8000` (FastAPI static files, limited public route)
  - `mawster.app` → permanent redirect to `https://www.mawster.app`
- Security headers middleware (X-Frame-Options, X-Content-Type-Options, etc.) applied via Traefik labels
- API has **no Traefik labels** — not publicly routable, internal network only

### Volumes

| Volume | Service | Purpose |
|---|---|---|
| `data_db` | mariadb | MariaDB data directory |
| `caddy_data` → `traefik_data` | traefik | ACME certificates |
| `api_logs` | api | Persistent log files |
| `backups` | backup | Local SQL dump files |

---

## Stack Observability (`stack-obs.yaml`)

### Services

| Service | Image | Purpose |
|---|---|---|
| `prometheus` | `prom/prometheus` | Scrapes Traefik + API metrics |
| `loki` | `grafana/loki` | Log aggregation |
| `promtail` | `grafana/promtail` | Collects Docker logs → Loki |
| `grafana` | `grafana/grafana` | Dashboards |

### Prometheus scrape targets

- `traefik:8082/metrics` — HTTP metrics (latency, status codes, request rate per route)
- `api:8000/metrics` — FastAPI metrics via `prometheus-fastapi-instrumentator`

Prometheus joins 3 networks: `obs` (Grafana), `traefik-public` (scrape Traefik), `internal` (scrape API).

### Grafana access

Grafana is **not publicly exposed**. Access via SSH tunnel only:

```bash
ssh -L 3000:grafana:3000 user@mawster.app
# then open http://localhost:3000
```

This eliminates the attack surface entirely. No Traefik labels on Grafana.

### Promtail

Collects logs from all Docker containers via `/var/run/docker.sock`. Labels: `service`, `stack`, `node`. Must run on every node (global mode when scaling beyond 1 node).

---

## Docker Secrets

All sensitive values are stored as Docker Swarm secrets. **Created once manually on the server** — the CI never creates or modifies secrets.

### Secret list

| Secret name | Source | Used by |
|---|---|---|
| `mawster_secret_key` | api.env `SECRET_KEY` | api |
| `mawster_db_password` | api.env + db.env `MARIADB_PASSWORD` | api, mariadb, backup |
| `mawster_db_root_password` | api.env + db.env `MARIADB_ROOT_PASSWORD` | api, mariadb, backup |
| `mawster_email_pepper` | api.env `EMAIL_PEPPER` | api |
| `mawster_nextauth_secret` | front.env `NEXTAUTH_SECRET` | front |
| `mawster_discord_client_id` | front.env `DISCORD_CLIENT_ID` | front |
| `mawster_discord_client_secret` | front.env `DISCORD_CLIENT_SECRET` | front |

### Non-sensitive config (stays as `environment` in stack)

`ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `MARIADB_USER`, `MARIADB_PORT`, `MARIADB_DATABASE`, `ALLOWED_ORIGINS`, `API_PORT`, `EMAIL_PEPPER_VERSION`, `MODE`, `CONTAINER`, `NEXTAUTH_URL`, `NEXTAUTH_URL_INTERNAL`, `TZ`

### Application integration

Secrets are mounted at `/run/secrets/<name>`. The `run.sh` wrapper reads them and exports as env vars before starting the process — no application code changes required:

```bash
#!/usr/bin/env sh
export SECRET_KEY=$(cat /run/secrets/mawster_secret_key)
export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
export EMAIL_PEPPER=$(cat /run/secrets/mawster_email_pepper)
exec uvicorn src.main:app ...
```

### Updating a secret

Docker secrets are immutable. To rotate a secret:
1. `docker secret create mawster_secret_key_v2 <new_value>`
2. Update `stack-app.yaml` to reference `mawster_secret_key_v2`
3. `docker stack deploy` — rolling update picks up the new secret

---

## Database Migrations

Migrations run as a **one-shot container** in the CI deploy step, before `docker stack deploy`. This guarantees the schema is up to date before any new API replica starts.

```bash
# In CI deploy step (SSH):
docker run --rm \
  --network mawster_internal \
  sneaxiii/mawster-api:latest \
  alembic upgrade head

docker stack deploy \
  --with-registry-auth \
  --resolve-image always \
  -c /root/Mawster/stack-app.yaml \
  mawster
```

The `internal` network must be `attachable: true` to allow standalone containers to join it.

**Why not in `command`:** With `order: start-first`, the new replica starts before the old stops. Both replicas would race to run `alembic upgrade head`. Running migration outside the service, before deploy, eliminates this race entirely.

---

## CI Pipeline Changes

### Updated `changes` job

Adds `backup/` path detection alongside `api/` and `front/`.

### New `docker-backup` job

Builds and pushes `sneaxiii/mawster-backup:latest` when `backup/` has changed. Same pattern as `docker-api` and `docker-front`.

### Updated `deploy` job

```yaml
deploy:
  needs: [docker-api, docker-front, docker-backup]
  if: # any succeeded, none failed
  steps:
    - name: Deploy via SSH
      uses: appleboy/ssh-action@v1
      with:
        script: |
          cd /root/Mawster
          docker pull sneaxiii/mawster-api:latest
          docker pull sneaxiii/mawster-front:latest
          docker pull sneaxiii/mawster-backup:latest
          docker run --rm --network mawster_internal \
            sneaxiii/mawster-api:latest \
            alembic upgrade head
          docker stack deploy \
            --with-registry-auth \
            --resolve-image always \
            -c stack-app.yaml \
            mawster
```

`--with-registry-auth` passes Docker Hub credentials to Swarm so nodes can pull private images.

---

## API: prometheus-fastapi-instrumentator

Add `prometheus-fastapi-instrumentator` to `api/pyproject.toml` dependencies.

In `api/src/main.py` (FastAPI app init):

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

This exposes `/metrics` on the API. Prometheus scrapes `api:8000/metrics` via the `obs` → `internal` network bridge (Prometheus joins both networks).

---

## Files to Create / Modify

### New files
- `stack-app.yaml` — Swarm stack for the application
- `stack-obs.yaml` — Swarm stack for observability
- `prometheus/prometheus.yml` — Prometheus scrape config
- `loki/loki-config.yaml` — Loki config
- `promtail/promtail-config.yaml` — Promtail config

### Modified files
- `api/run.sh` — read secrets from `/run/secrets/`, export as env vars
- `front/run.sh` — same pattern for front secrets
- `api/pyproject.toml` — add `prometheus-fastapi-instrumentator`
- `api/src/main.py` — instrument FastAPI with Prometheus
- `.github/workflows/api_front__test_lint_build.yaml` — add `docker-backup` job, update `deploy` step
- `backup/Dockerfile` — no `build:` needed, image pushed to Docker Hub

### Removed files
- `compose-prod.yaml` — replaced by `stack-app.yaml`
- `Caddyfile` — replaced by Traefik labels in `stack-app.yaml`
- `api.env`, `db.env`, `front.env` — replaced by Docker secrets (deleted from server after migration)

---

## Migration Steps (server, one-time)

1. `docker swarm init`
2. Create all Docker secrets via `docker secret create`
3. Create overlay networks: `docker network create --driver overlay --attachable traefik-public internal obs`
4. Deploy obs stack: `docker stack deploy -c stack-obs.yaml mawster-obs`
5. Deploy app stack: `docker stack deploy -c stack-app.yaml mawster`
6. Verify services: `docker service ls`
7. Delete old `.env` files from server
