Lance tous les tests E2E en parallèle (chaque worker a son propre backend + frontend + DB).

## Étapes

1. Appeler `mcp__cypress-runner__run_parallel` (défaut : 2 workers) et reporter les résultats.
2. Si des suites échouent, les relancer avec `/test-e2e-failing`.
