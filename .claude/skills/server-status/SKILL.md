---
name: server-status
description: Use when checking if dev or test servers are running — shows which ports are bound and which containers are up.
---

# Server Status

Aucun daemon ne suit l'état des serveurs : on interroge directement les ports et Docker.

## Ports applicatifs

```bash
ss -ltnp 2>/dev/null | grep -E ':(3000|3001|8000|8001|301[0-9]|801[0-9])\b' || echo "aucun serveur applicatif"
```

| Port | Rôle |
|------|------|
| `8000` / `3000` | API + front en mode dev (`/server-dev`) |
| `8010+N` / `3010+N` | Workers E2E lancés par `scripts/e2e_parallel.py` (`/test-e2e`) |

## Conteneurs

```bash
docker compose -f compose-dev.yaml ps
```

`mariadb-dev` → **3305**, `mariadb-test` → **3307** (requis pour les E2E).

## Arrêter

Voir `/server-stop`.
