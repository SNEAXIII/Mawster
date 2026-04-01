Lance tous les tests E2E en parallèle (chaque worker a son propre backend + frontend + DB).

**Outil unique** : `mcp__cypress-runner__run_parallel` — ne jamais utiliser `mcp__server-runner__run_e2e`.

## Paramètres

- `workers` (1–8, défaut 4) : nombre de workers parallèles. Passer `workers=1` pour un run séquentiel sur un seul worker.
- `spec_files` : liste de specs ciblées (chemins relatifs à `front/cypress/e2e/`). Si omis, toutes les specs sont lancées.

## Étapes

1. Appeler `mcp__cypress-runner__run_parallel` et reporter les résultats.
2. Si des suites échouent, les relancer avec `/test-e2e-failing`.
