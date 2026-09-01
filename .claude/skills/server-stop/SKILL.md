---
name: server-stop
description: Use when stopping all running servers — kills the dev API/front processes and stops the Docker stack.
---

# Server Stop

## 1. Processus applicatifs

Tuer ce qui écoute sur les ports du projet (dev + workers E2E) :

```bash
for p in 3000 3001 8000 8001 3010 3011 3012 3013 8010 8011 8012 8013; do
  fuser -k -n tcp $p 2>/dev/null
done
```

Si les serveurs ont été lancés en background depuis la session, préférer tuer ces
jobs-là plutôt que le balayage par port.

## 2. Infra Docker

```bash
docker compose -f compose-dev.yaml down
```

Sans `-v` : les volumes (donc les données de la DB de dev) sont conservés.
N'ajouter `-v` que si l'utilisateur demande explicitement de repartir de zéro.

## Vérifier

`/server-status` — aucun port applicatif ne doit plus être bound.
