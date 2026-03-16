Lance les tests pytest backend.

## Avant de lancer les tests

Toujours exécuter en premier : `rm -rf api/temp/*` (vide le dossier des bases SQLite de test).

## Comportement selon $ARGUMENTS

| Argument | Action |
|---|---|
| (vide) | Use `mcp__pytest-runner__run_all_tests` to run the full suite |
| `<path>` | Run `uv run pytest $ARGUMENTS -v --tb=short` in `api/` to target a specific file or folder |

Report the result. On failure, display the errors and identify the cause.

## Notes
- `xfail`/`skip` are not failures
- Do not modify tests unless explicitly asked
