Exécute une cible du Makefile depuis `.//api`.

## Cibles disponibles

| Cible            | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `run-dev`        | Démarre FastAPI en mode dev avec auto-reload              |
| `run-testing`    | Démarre le serveur en mode test                           |
| `install`        | Installe les dépendances prod                             |
| `install-dev`    | Installe prod + dev                                       |
| `test`           | Lance les tests (6 workers xdist)                         |
| `test-cov`       | Lance les tests avec coverage                             |
| `create-mig`     | Crée une migration (préférer `/migrate create`)           |
| `migrate`        | Applique les migrations (préférer `/migrate`)             |
| `fixtures`       | Charge les fixtures dev (préférer `/fixtures`)            |
| `load-champions` | Charge les champions (préférer `/fixtures champions`)     |
| `init-db`        | Init prod minimale (préférer `/fixtures init`)            |
| `cancel-last`    | Annule la dernière migration (préférer `/migrate cancel`) |
| `reset-db`       | ⚠️ Remet la DB à zéro — demander confirmation             |

## Étapes

1. Si `$ARGUMENTS` est vide → exécuter `make help`
2. Si cible destructive (`reset-db`) → demander confirmation
3. Se placer dans `.//api`
4. Exécuter `make $ARGUMENTS`
5. Afficher le résultat et signaler toute erreur
