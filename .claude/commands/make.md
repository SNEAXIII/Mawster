Exécute une cible du Makefile depuis `./api`.

| Cible            | Description                          |
| ---------------- | ------------------------------------ |
| `run-dev`        | FastAPI dev avec auto-reload         |
| `run-testing`    | Serveur mode test                    |
| `install`        | Dépendances prod                     |
| `install-dev`    | Dépendances prod + dev               |
| `test`           | Tests (6 workers xdist)              |
| `test-cov`       | Tests avec coverage                  |
| `create-mig`     | Crée une migration Alembic           |
| `migrate`        | Applique les migrations              |
| `fixtures`       | Charge les fixtures dev              |
| `load-champions` | Charge les champions                 |
| `cancel-last`    | Annule la dernière migration         |
| `reset-db`       | ⚠️ Remet la DB à zéro               |

Si `$ARGUMENTS` vide → `make help`. Si `reset-db` → demander confirmation. Sinon `cd api && make $ARGUMENTS`. Afficher le résultat.
