---
name: server-dev
description: Use when starting the dev server — launches MariaDB (Docker), FastAPI (8000), and Next.js (3000) in dev mode.
---

# Server Dev

Lance l'environnement de dev complet. Trois briques, dans cet ordre.

## 1. Infra Docker

```bash
docker compose -f compose-dev.yaml up -d mariadb-dev phpmyadmin-dev
```

`mariadb-dev` écoute sur **3305** (phpMyAdmin **8080**). Ajouter `rabbitmq rustfs vision-worker`
uniquement si la feature touche la vision.

## 2. Backend

```bash
cd api && make run-dev     # FastAPI, port 8000
```

## 3. Frontend

```bash
cd front && npm run dev    # Next.js, port 3000
```

## Notes

- Les deux serveurs tournent au premier plan : les lancer en background (`run_in_background`)
  et récupérer la sortie ensuite, sinon la session bloque.
- Première utilisation ou après un reset : `cd api && make repopulate-db`.
- Ports : API `8000`, front `3000`, phpMyAdmin `8080`, MariaDB `3305`.
- Ne rien lancer sur `3001`/`8001`/`3010+` : c'est la plage utilisée par les E2E
  (`/test-e2e`), qui gère sa propre stack.
