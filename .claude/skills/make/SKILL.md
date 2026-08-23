---
name: make
description: Use when running any backend Makefile target — always via `make` from `api/`, never raw pytest/alembic/uvicorn.
---

# Make

Toutes les commandes backend passent par `make` depuis `api/`. Ne jamais appeler `pytest`, `alembic` ou `uvicorn` directement.

## Commandes

```bash
cd api

make test              # pytest -n 10 (parallèle)
make test-cov          # pytest --cov -n 10
make reset-db          # reset la DB de dev
make create-mig MESSAGE="add_x_to_y"  # nouvelle migration
make migrate           # appliquer migrations en attente
make cancel-last       # annuler la dernière migration
make fixtures          # charger les données de dev
make load-champions    # charger les champions depuis champions.json
make load-masteries    # charger les maîtrises
make repopulate-db     # reset + load-champions + load-masteries + fixtures
make check             # ruff lint
make fix               # ruff lint --fix
make format            # ruff format
make run-dev           # serveur dev (port 8000)
make run-testing       # serveur test (port 8001)
make install           # dépendances prod
make install-dev       # dépendances prod + dev
make scrape-champions  # re-scrape la liste des champions
make seed-user         # crée un utilisateur de dev
```

`make help` liste les cibles à jour — s'y référer si un appel échoue sur une cible inconnue.

## Important

- Appel sans argument → `make help`
- `make reset-db` et `make delete-db` écrasent la DB de dev — demander confirmation avant, et
  utiliser `/db-migrate` pour les migrations (DB dédiée `mawster_migrate`)
- `make create-mig` nécessite toujours un `MESSAGE`
- `make test` lance 10 workers xdist par défaut
