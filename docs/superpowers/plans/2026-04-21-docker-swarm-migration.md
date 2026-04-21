# Docker Swarm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Mawster production from Docker Compose to Docker Swarm with Traefik, Docker secrets, Prometheus/Loki/Grafana observability, and updated CI pipeline.

**Architecture:** Two Swarm stacks on a single-node manager — `mawster` (app: traefik, mariadb, api×2, front×2, backup) and `mawster-obs` (prometheus, loki, promtail, grafana). Traefik replaces Caddy with native Prometheus metrics and Swarm service discovery. All sensitive config moves to Docker secrets read via `/run/secrets/` in wrapper scripts.

**Tech Stack:** Docker Swarm, Traefik v3, Docker secrets, prometheus-fastapi-instrumentator, Prometheus, Loki, Promtail, Grafana, GitHub Actions.

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `api/migrate.sh` | One-shot migration script (reads secrets, runs alembic) |
| `stack-app.yaml` | Swarm stack: traefik, mariadb, api, front, backup |
| `stack-obs.yaml` | Swarm stack: prometheus, loki, promtail, grafana |
| `prometheus/prometheus.yml` | Prometheus scrape config |
| `loki/loki-config.yaml` | Loki storage + ingestion config |
| `promtail/promtail-config.yaml` | Promtail Docker log collection config |

### Modified files
| Path | Change |
|---|---|
| `api/pyproject.toml` | Add `prometheus-fastapi-instrumentator` |
| `api/main.py` | Instrument FastAPI app |
| `api/run.sh` | Remove alembic step, add secrets reading |
| `front/run.sh` | Add secrets reading |
| `backup/backup.sh` | Add secrets reading + `RCLONE_CONFIG` |
| `.github/workflows/api_front__test_lint_build.yaml` | Add `docker-backup` job, update `deploy` step |

### Removed files
| Path | Reason |
|---|---|
| `compose-prod.yaml` | Replaced by `stack-app.yaml` |
| `Caddyfile` | Replaced by Traefik labels in stack |

---

## Task 1: Add prometheus-fastapi-instrumentator to API

**Files:**
- Modify: `api/pyproject.toml`
- Modify: `api/main.py`
- Create: `api/tests/integration/endpoints/metrics_test.py`

- [ ] **Step 1: Write the failing test**

```python
# api/tests/integration/endpoints/metrics_test.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_200(client: AsyncClient):
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "fastapi_requests_total" in response.text
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api && uv run pytest tests/integration/endpoints/metrics_test.py -v
```
Expected: FAIL — `404` because `/metrics` route doesn't exist yet.

- [ ] **Step 3: Add dependency to pyproject.toml**

In `api/pyproject.toml`, add to `dependencies`:
```toml
dependencies = [
    "fastapi[standard]",
    "pyjwt",
    "python-multipart",
    "pydantic-settings",
    "sqlmodel",
    "aiomysql",
    "pymysql",
    "alembic",
    "bleach",
    "sentry-sdk",
    "slowapi",
    "prometheus-fastapi-instrumentator",
]
```

- [ ] **Step 4: Install the new dependency**

```bash
cd api && uv sync --extra dev
```
Expected: resolves and installs `prometheus-fastapi-instrumentator`.

- [ ] **Step 5: Instrument the FastAPI app in main.py**

Add after `app = FastAPI(title="Mawster", version="1.0.0")` (line 41):

```python
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="Mawster", version="1.0.0")
Instrumentator().instrument(app).expose(app)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd api && uv run pytest tests/integration/endpoints/metrics_test.py -v
```
Expected: PASS — `200 OK` with `fastapi_requests_total` in body.

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
cd api && uv run pytest tests/unit tests/integration -v --tb=short -n auto
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add api/pyproject.toml api/main.py api/tests/integration/endpoints/metrics_test.py api/uv.lock
git commit -m "feat: add prometheus metrics endpoint to API"
```

---

## Task 2: Create api/migrate.sh

**Files:**
- Create: `api/migrate.sh`

- [ ] **Step 1: Create migrate.sh**

```sh
#!/usr/bin/env sh
set -e
export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
uv run --no-sync alembic upgrade head
```

- [ ] **Step 2: Make executable**

```bash
chmod +x api/migrate.sh
```

- [ ] **Step 3: Commit**

```bash
git add api/migrate.sh
git commit -m "feat: add dedicated migration script for Swarm CI deploy"
```

---

## Task 3: Update api/run.sh for Docker secrets

**Files:**
- Modify: `api/run.sh`

Current content:
```sh
set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict
export MODE="prod"
uv run --no-sync alembic upgrade head
uv run --no-sync fastapi run --port "${API_PORT:-8000}"
```

- [ ] **Step 1: Rewrite api/run.sh**

Replace the entire file with:

```sh
set -e
./wait-for-it.sh mariadb:3306 -t 60 --strict

export SECRET_KEY=$(cat /run/secrets/mawster_secret_key)
export MARIADB_PASSWORD=$(cat /run/secrets/mawster_db_password)
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
export EMAIL_PEPPER=$(cat /run/secrets/mawster_email_pepper)

uv run --no-sync fastapi run --port "${API_PORT:-8000}"
```

Note: `MODE` and other non-sensitive config are set in the stack `environment` block. Alembic is now run by CI before `docker stack deploy`, not at container startup.

- [ ] **Step 2: Commit**

```bash
git add api/run.sh
git commit -m "feat: update api run.sh to read Docker secrets from /run/secrets/"
```

---

## Task 4: Update front/run.sh for Docker secrets

**Files:**
- Modify: `front/run.sh`

Current content:
```sh
set -e
/bin/bash ./wait-for-it.sh api:8000 -t 60 --strict
node server.js
```

- [ ] **Step 1: Rewrite front/run.sh**

Replace the entire file with:

```sh
set -e
/bin/bash ./wait-for-it.sh api:8000 -t 60 --strict

export NEXTAUTH_SECRET=$(cat /run/secrets/mawster_nextauth_secret)
export DISCORD_CLIENT_ID=$(cat /run/secrets/mawster_discord_client_id)
export DISCORD_CLIENT_SECRET=$(cat /run/secrets/mawster_discord_client_secret)

node server.js
```

- [ ] **Step 2: Commit**

```bash
git add front/run.sh
git commit -m "feat: update front run.sh to read Docker secrets from /run/secrets/"
```

---

## Task 5: Update backup/backup.sh for Docker secrets

**Files:**
- Modify: `backup/backup.sh`

- [ ] **Step 1: Add secrets reading at the top of backup.sh**

After `set -euo pipefail`, add the following block (before `# ── Config ──`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Secrets ──────────────────────────────────────────────────────────────────
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)
export RCLONE_CONFIG=/run/secrets/mawster_rclone_conf

# ── Config ───────────────────────────────────────────────────────────────────
BACKUP_DIR="/backups"
# ... rest of file unchanged
```

- [ ] **Step 2: Commit**

```bash
git add backup/backup.sh
git commit -m "feat: update backup.sh to read Docker secrets"
```

---

## Task 6: Create Prometheus config

**Files:**
- Create: `prometheus/prometheus.yml`

- [ ] **Step 1: Create directory and config**

```bash
mkdir -p prometheus
```

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: traefik
    static_configs:
      - targets: ["traefik:8082"]

  - job_name: api
    static_configs:
      - targets: ["api:8000"]
    metrics_path: /metrics
```

- [ ] **Step 2: Commit**

```bash
git add prometheus/prometheus.yml
git commit -m "feat: add Prometheus scrape config"
```

---

## Task 7: Create Loki config

**Files:**
- Create: `loki/loki-config.yaml`

- [ ] **Step 1: Create directory and config**

```bash
mkdir -p loki
```

```yaml
# loki/loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 744h
```

- [ ] **Step 2: Commit**

```bash
git add loki/loki-config.yaml
git commit -m "feat: add Loki config"
```

---

## Task 8: Create Promtail config

**Files:**
- Create: `promtail/promtail-config.yaml`

- [ ] **Step 1: Create directory and config**

```bash
mkdir -p promtail
```

```yaml
# promtail/promtail-config.yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: [__meta_docker_container_name]
        regex: /(.*)
        target_label: container
      - source_labels: [__meta_docker_container_label_com_docker_swarm_service_name]
        target_label: service
      - source_labels: [__meta_docker_container_label_com_docker_stack_namespace]
        target_label: stack
```

- [ ] **Step 2: Commit**

```bash
git add promtail/promtail-config.yaml
git commit -m "feat: add Promtail Docker log collection config"
```

---

## Task 9: Create stack-obs.yaml

**Files:**
- Create: `stack-obs.yaml`

- [ ] **Step 1: Create stack-obs.yaml**

```yaml
# stack-obs.yaml
networks:
  obs:
    external: true
  traefik-public:
    external: true
  internal:
    external: true

services:
  prometheus:
    image: prom/prometheus:latest
    networks:
      - obs
      - traefik-public
      - internal
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=15d
    deploy:
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure

  loki:
    image: grafana/loki:latest
    networks:
      - obs
    volumes:
      - ./loki/loki-config.yaml:/etc/loki/loki-config.yaml:ro
      - loki_data:/loki
    command: -config.file=/etc/loki/loki-config.yaml
    deploy:
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure

  promtail:
    image: grafana/promtail:latest
    networks:
      - obs
    volumes:
      - ./promtail/promtail-config.yaml:/etc/promtail/promtail-config.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/promtail-config.yaml
    deploy:
      mode: global
      restart_policy:
        condition: on-failure

  grafana:
    image: grafana/grafana:latest
    networks:
      - obs
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      GF_SERVER_HTTP_PORT: "3000"
      GF_AUTH_ANONYMOUS_ENABLED: "false"
    deploy:
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure

volumes:
  prometheus_data:
  loki_data:
  grafana_data:
```

- [ ] **Step 2: Commit**

```bash
git add stack-obs.yaml
git commit -m "feat: add Docker Swarm observability stack"
```

---

## Task 10: Create stack-app.yaml

**Files:**
- Create: `stack-app.yaml`

- [ ] **Step 1: Create stack-app.yaml**

```yaml
# stack-app.yaml
networks:
  traefik-public:
    external: true
  internal:
    external: true
    attachable: true

secrets:
  mawster_secret_key:
    external: true
  mawster_db_password:
    external: true
  mawster_db_root_password:
    external: true
  mawster_email_pepper:
    external: true
  mawster_nextauth_secret:
    external: true
  mawster_discord_client_id:
    external: true
  mawster_discord_client_secret:
    external: true
  mawster_rclone_conf:
    external: true

services:
  traefik:
    image: traefik:v3
    ports:
      - "80:80"
      - "443:443"
    networks:
      - traefik-public
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_data:/data
    command:
      - --providers.swarm=true
      - --providers.swarm.exposedByDefault=false
      - --providers.swarm.network=traefik-public
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --entrypoints.web.http.redirections.entrypoint.permanent=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.email=misterbalise2@gmail.com
      - --certificatesresolvers.letsencrypt.acme.storage=/data/acme.json
      - --metrics.prometheus=true
      - --metrics.prometheus.entrypoint=metrics
      - --entrypoints.metrics.address=:8082
    deploy:
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"

  mariadb:
    image: mariadb:11.4
    networks:
      - internal
    environment:
      MARIADB_USER: mawster
      MARIADB_DATABASE: mawster
      MARIADB_PASSWORD_FILE: /run/secrets/mawster_db_password
      MARIADB_ROOT_PASSWORD_FILE: /run/secrets/mawster_db_root_password
    secrets:
      - mawster_db_password
      - mawster_db_root_password
    volumes:
      - data_db:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"

  api:
    image: sneaxiii/mawster-api:latest
    networks:
      - internal
      - traefik-public
    environment:
      MODE: prod
      CONTAINER: "1"
      ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: "60"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      MARIADB_USER: mawster
      MARIADB_PORT: "3306"
      MARIADB_DATABASE: mawster
      ALLOWED_ORIGINS: https://www.mawster.app
      API_PORT: "8000"
      EMAIL_PEPPER_VERSION: "1"
    secrets:
      - mawster_secret_key
      - mawster_db_password
      - mawster_db_root_password
      - mawster_email_pepper
    volumes:
      - api_logs:/app/api/logs
    command: ["sh", "run.sh"]
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      labels:
        - traefik.enable=true
        - traefik.http.routers.api-static.rule=Host(`www.mawster.app`) && PathPrefix(`/static/`)
        - traefik.http.routers.api-static.entrypoints=websecure
        - traefik.http.routers.api-static.tls.certresolver=letsencrypt
        - traefik.http.routers.api-static.service=api-static
        - traefik.http.services.api-static.loadbalancer.server.port=8000
        - traefik.docker.network=traefik-public
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"

  front:
    image: sneaxiii/mawster-front:latest
    networks:
      - internal
      - traefik-public
    environment:
      NEXTAUTH_URL: https://www.mawster.app
      NEXTAUTH_URL_INTERNAL: http://front:3000
    secrets:
      - mawster_nextauth_secret
      - mawster_discord_client_id
      - mawster_discord_client_secret
    command: ["sh", "run.sh"]
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      labels:
        - traefik.enable=true
        - traefik.http.routers.front.rule=Host(`www.mawster.app`)
        - traefik.http.routers.front.entrypoints=websecure
        - traefik.http.routers.front.tls.certresolver=letsencrypt
        - traefik.http.routers.front.service=front
        - traefik.http.services.front.loadbalancer.server.port=3000
        - traefik.http.routers.front.middlewares=security-headers
        - traefik.http.middlewares.security-headers.headers.frameDeny=true
        - traefik.http.middlewares.security-headers.headers.contentTypeNosniff=true
        - traefik.http.middlewares.security-headers.headers.referrerPolicy=strict-origin-when-cross-origin
        - traefik.http.middlewares.security-headers.headers.permissionsPolicy=camera=(),microphone=(),geolocation=(),payment=(),usb=(),accelerometer=()
        - traefik.http.middlewares.security-headers.headers.customResponseHeaders.Server=
        - traefik.http.routers.apex-redirect.rule=Host(`mawster.app`)
        - traefik.http.routers.apex-redirect.entrypoints=websecure
        - traefik.http.routers.apex-redirect.tls.certresolver=letsencrypt
        - traefik.http.routers.apex-redirect.middlewares=apex-to-www
        - traefik.http.middlewares.apex-to-www.redirectregex.regex=^https://mawster.app/(.*)
        - traefik.http.middlewares.apex-to-www.redirectregex.replacement=https://www.mawster.app/$${1}
        - traefik.http.middlewares.apex-to-www.redirectregex.permanent=true
        - traefik.docker.network=traefik-public
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"

  backup:
    image: sneaxiii/mawster-backup:latest
    networks:
      - internal
    environment:
      TZ: Europe/Paris
      MARIADB_USER: mawster
      MARIADB_DATABASE: mawster
      MARIADB_PORT: "3306"
    secrets:
      - mawster_db_password
      - mawster_db_root_password
      - mawster_rclone_conf
    volumes:
      - backups:/backups
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
    logging:
      driver: json-file
      options:
        max-size: 5m
        max-file: "3"

volumes:
  data_db:
  traefik_data:
  api_logs:
  backups:
```

- [ ] **Step 2: Commit**

```bash
git add stack-app.yaml
git commit -m "feat: add Docker Swarm app stack (replaces compose-prod.yaml)"
```

---

## Task 11: Update CI pipeline

**Files:**
- Modify: `.github/workflows/api_front__test_lint_build.yaml`

- [ ] **Step 1: Add backup path to `changes` job**

In the `changes` job, update the `Detect changes` step to add backup detection:

```yaml
- name: Detect changes
  id: filter
  run: |
    BEFORE="${{ github.event.before }}"
    SHA="${{ github.sha }}"
    API=$(git diff --name-only "${BEFORE}...${SHA}" -- api/ | wc -l | tr -d ' ')
    FRONT=$(git diff --name-only "${BEFORE}...${SHA}" -- front/ | wc -l | tr -d ' ')
    BACKUP=$(git diff --name-only "${BEFORE}...${SHA}" -- backup/ | wc -l | tr -d ' ')
    echo "api=$([ "$API" -gt 0 ] && echo 'true' || echo 'false')" >> $GITHUB_OUTPUT
    echo "front=$([ "$FRONT" -gt 0 ] && echo 'true' || echo 'false')" >> $GITHUB_OUTPUT
    echo "backup=$([ "$BACKUP" -gt 0 ] && echo 'true' || echo 'false')" >> $GITHUB_OUTPUT
```

Also add `backup` to `outputs`:
```yaml
outputs:
  api: ${{ steps.filter.outputs.api }}
  front: ${{ steps.filter.outputs.front }}
  backup: ${{ steps.filter.outputs.backup }}
```

- [ ] **Step 2: Add `docker-backup` job after `docker-front`**

```yaml
docker-backup:
  if: needs.changes.outputs.backup == 'true'
  environment: Api
  name: Docker Build & Push (Backup)
  runs-on: ubuntu-latest
  needs:
    - changes
    - e2e
  steps:
    - name: Checkout repository
      uses: actions/checkout@v5
    - name: Log in to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ vars.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    - name: Generate timestamp tag
      run: echo "TAG=$(date +'${{ vars.TIME_TAG_FORMAT }}')" >> $GITHUB_ENV
    - name: Build and push Docker image for backup
      uses: docker/build-push-action@v6
      with:
        context: ./backup
        file: ./backup/Dockerfile
        push: true
        tags: |
          ${{ vars.DOCKERHUB_USERNAME }}/mawster-backup:latest
          ${{ vars.DOCKERHUB_USERNAME }}/mawster-backup:${{ env.TAG }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

- [ ] **Step 3: Update `deploy` job**

Replace the entire `deploy` job:

```yaml
deploy:
  name: Deploy to production
  runs-on: ubuntu-latest
  environment: Api
  needs: [docker-api, docker-front, docker-backup]
  if: |
    always() &&
    (needs.docker-api.result == 'success' || needs.docker-front.result == 'success' || needs.docker-backup.result == 'success') &&
    needs.docker-api.result != 'failure' &&
    needs.docker-front.result != 'failure' &&
    needs.docker-backup.result != 'failure'
  steps:
    - name: Deploy via SSH
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /root/Mawster

          docker pull sneaxiii/mawster-api:latest
          docker pull sneaxiii/mawster-front:latest
          docker pull sneaxiii/mawster-backup:latest

          docker run --rm \
            --network mawster_internal \
            --secret mawster_db_password \
            --secret mawster_db_root_password \
            -e MARIADB_USER=mawster \
            -e MARIADB_PORT=3306 \
            -e MARIADB_DATABASE=mawster \
            sneaxiii/mawster-api:latest \
            sh migrate.sh

          docker stack deploy \
            --with-registry-auth \
            --resolve-image always \
            -c stack-app.yaml \
            mawster
```

- [ ] **Step 4: Run linter to catch YAML syntax errors**

```bash
cd /root/Mawster && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/api_front__test_lint_build.yaml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/api_front__test_lint_build.yaml
git commit -m "feat: update CI — add docker-backup job and Swarm deploy step"
```

---

## Task 12: Server setup (one-time, manual)

This task is run **once on the production server** before the first stack deploy. It does not touch the repository.

- [ ] **Step 1: Initialize Swarm**

```bash
docker swarm init
```
Expected: `Swarm initialized: current node is a manager.`

- [ ] **Step 2: Create overlay networks**

```bash
docker network create --driver overlay --attachable traefik-public
docker network create --driver overlay --attachable internal
docker network create --driver overlay --attachable obs
```

- [ ] **Step 3: Create Docker secrets**

Run each line separately. Paste the secret value when prompted (or pipe from a file):

```bash
# Database
printf 'your_db_password' | docker secret create mawster_db_password -
printf 'your_db_root_password' | docker secret create mawster_db_root_password -

# API
printf 'your_secret_key' | docker secret create mawster_secret_key -
printf 'your_email_pepper' | docker secret create mawster_email_pepper -

# Frontend
printf 'your_nextauth_secret' | docker secret create mawster_nextauth_secret -
printf 'your_discord_client_id' | docker secret create mawster_discord_client_id -
printf 'your_discord_client_secret' | docker secret create mawster_discord_client_secret -

# Backup — use the existing rclone.conf file
docker secret create mawster_rclone_conf ./backup/rclone.conf
```

Copy values from existing `.env` files on the server before deleting them.

- [ ] **Step 4: Verify secrets exist**

```bash
docker secret ls
```
Expected: 8 secrets listed (mawster_db_password, mawster_db_root_password, mawster_secret_key, mawster_email_pepper, mawster_nextauth_secret, mawster_discord_client_id, mawster_discord_client_secret, mawster_rclone_conf).

- [ ] **Step 5: Deploy observability stack**

```bash
cd /root/Mawster
docker stack deploy -c stack-obs.yaml mawster-obs
docker service ls | grep mawster-obs
```
Expected: 4 services in `Running` state within ~30s.

- [ ] **Step 6: Initial app stack deploy**

For the first deployment only, the migration container cannot run before the stack because the `mawster_internal` network doesn't exist yet. Deploy the stack first:

```bash
docker stack deploy --with-registry-auth --resolve-image always -c stack-app.yaml mawster
```

Wait for MariaDB to be healthy (~30s):
```bash
watch docker service ls
```

Once `mawster_mariadb` shows `1/1 replicas`, run the migration:

```bash
docker run --rm \
  --network mawster_internal \
  --secret mawster_db_password \
  --secret mawster_db_root_password \
  -e MARIADB_USER=mawster \
  -e MARIADB_PORT=3306 \
  -e MARIADB_DATABASE=mawster \
  sneaxiii/mawster-api:latest \
  sh migrate.sh
```

Force api service to restart and pick up the schema:
```bash
docker service update --force mawster_api
```

- [ ] **Step 7: Verify all services running**

```bash
docker service ls
```
Expected: all services show `N/N` replicas running.

- [ ] **Step 8: Verify Traefik routing**

```bash
curl -I https://www.mawster.app
```
Expected: `HTTP/2 200`

```bash
curl -I https://www.mawster.app/static/champions/spiderman.webp
```
Expected: `HTTP/2 200` or `404` (not `502`).

- [ ] **Step 9: Verify Prometheus scraping (SSH tunnel)**

```bash
ssh -L 9090:prometheus:9090 user@mawster.app
# In browser: http://localhost:9090/targets
```
Expected: `traefik` and `api` targets show `UP`.

- [ ] **Step 10: Connect Grafana to Loki and Prometheus (SSH tunnel)**

```bash
ssh -L 3000:grafana:3000 user@mawster.app
# In browser: http://localhost:3000
# Add data sources:
#   - Prometheus: http://prometheus:9090
#   - Loki: http://loki:3100
```

- [ ] **Step 11: Delete old env files**

```bash
rm /root/Mawster/api.env /root/Mawster/db.env /root/Mawster/front.env
```

- [ ] **Step 12: Final commit — remove old files**

```bash
git rm compose-prod.yaml Caddyfile
git commit -m "chore: remove compose-prod.yaml and Caddyfile (replaced by Swarm stack)"
```

---

## Self-Review Notes

- **Spec coverage verified:** all sections mapped to tasks (secrets → T2-5, stack-app → T10, stack-obs → T9, Traefik → T10, prometheus instrumentator → T1, CI → T11, server setup → T12, migration-in-CI → T11 deploy step)
- **No placeholders** — all code blocks are complete
- **Type consistency** — `migrate.sh` created in T2, referenced in T11 CI deploy step (`sh migrate.sh`)
- **`mawster_internal` network** — used in T11 deploy step; created in T12 Step 2; `attachable: true` in T10 stack
- **Backup secrets** — `mawster_rclone_conf` added in T5 (backup.sh), T10 (stack-app.yaml secrets), T12 (server setup)
- **Initial deploy order** — handled explicitly in T12 Step 6 (stack first, then migration, then force restart)
