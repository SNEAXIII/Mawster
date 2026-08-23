# MCP Servers & tooling

Mawster déclare ses serveurs MCP dans `.mcp.json`. Ils étendent Claude Code avec des outils
transverses ; tout ce qui est spécifique au projet (serveurs, tests, DB) passe par des
commandes normales, documentées ici et exposées via les skills de `.claude/skills/`.

---

## Serveurs déclarés

| Server | Source | Purpose |
|--------|--------|---------|
| `context-mode` | Plugin (Claude Code) | Garde la sortie des commandes hors du contexte |
| `github` | `@modelcontextprotocol/server-github` | API GitHub (issues, PRs, fichiers) |

> Les serveurs `server-runner`, `pytest-runner` et `db-manager` ont été retirés : le dossier
> `mcp/` n'existe plus et ils n'étaient plus déclarés dans `.mcp.json`. Leurs skills pointent
> désormais sur les commandes réelles ci-dessous.

---

## context-mode

Plugin géré par Claude Code (pas dans `.mcp.json` côté code). Garde la sortie des commandes
hors de la fenêtre de contexte.

| Tool | Description |
|------|-------------|
| `ctx_batch_execute` | Plusieurs commandes + requêtes sémantiques d'un coup |
| `ctx_execute` | Une commande, résultat indexé |
| `ctx_execute_file` | Lit/analyse un fichier sans le charger en contexte |
| `ctx_search` | Recherche sémantique sur le contenu indexé |
| `ctx_fetch_and_index` | Récupère une URL et l'indexe |
| `ctx_stats` | Stats d'utilisation du contexte |

**Convention (CLAUDE.md)** : `ctx_execute_file` pour analyser un fichier, `Read` seulement
juste avant un `Edit` ; pas d'agents Explore (utiliser `ctx_batch_execute`) ; pas de
`WebFetch` (utiliser `ctx_fetch_and_index`).

---

## github

Package standard `@modelcontextprotocol/server-github`. Nécessite `GITHUB_PERSONAL_ACCESS_TOKEN`
dans l'environnement. Couvre issues, pull requests, branches, fichiers, recherche, commentaires,
reviews, merges.

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

Préfixe des outils : `mcp__github__*` (ex : `mcp__github__create_pull_request`, utilisé par
`/open-pr`).

---

## Commandes projet (ex-MCP)

### Serveurs — `/server-dev`, `/server-stop`, `/server-status`

```bash
docker compose -f compose-dev.yaml up -d mariadb-dev phpmyadmin-dev
cd api && make run-dev      # API 8000
cd front && npm run dev     # Front 3000
```

MariaDB dev **3305**, MariaDB test **3307**, phpMyAdmin **8080** / **8081**.

### Tests backend — `/make`

```bash
cd api
make test        # pytest -n 10
make test-cov    # avec coverage
uv run pytest tests/unit/dto/dto_from_model_test.py --tb=line -q   # fichier isolé
```

À lancer via `ctx_execute` : la sortie pytest est longue et seules les erreurs comptent.

### E2E — `/test-e2e`

`scripts/e2e_parallel.py` est le point d'entrée unique, le même que la CI. Il build `.next-e2e`,
monte un backend + un front par worker (`8010+N` / `3010+N`, DB `mawster_test_N`), lance Cypress
puis nettoie. Requiert `mariadb-test` sur **3307**.

```bash
python3 scripts/e2e_parallel.py --spec "war/operations.cy.ts,roster/roster.cy.ts" --quiet
python3 scripts/e2e_parallel.py --workers 4 --quiet     # suite complète
```

Artefacts dans `front/cypress/results/` — comparer leur `mtime` à l'heure du run avant de croire
un vert.

### Base de données — `/db-migrate`, `/make`

```bash
cd api
make repopulate-db    # reset + champions + masteries + fixtures
make load-champions
make migrate
MARIADB_DATABASE=mawster_migrate make create-mig MESSAGE="add_x_to_y"
```

`make reset-db` écrase la DB de dev — pour les migrations, toujours passer par `/db-migrate`
qui travaille sur la DB dédiée `mawster_migrate`.

---

## Ajouter ou modifier un serveur MCP

1. Ajouter l'entrée dans `.mcp.json`
2. **Redémarrer Claude Code** — les serveurs MCP sont chargés au démarrage
