---
name: db-migrate
description: Use when creating an Alembic migration — resets a dedicated migration DB, autogenerates the migration file, applies it, and shows the result for review.
---

# DB Migrate

Génère une migration Alembic sur une DB dédiée (`mawster_migrate`) sans toucher la DB de dev ou de test.

## Processus

1. **Dériver le MESSAGE** depuis le contexte fourni — snake_case, concis (ex: `add_discord_id_to_user`)
2. **Reset** la DB de migration
3. **Générer** la migration
4. **Appliquer** la migration
5. **Afficher** le fichier généré pour review

## Commandes

Toutes les commandes s'exécutent depuis `api/` avec `MARIADB_DATABASE=mawster_migrate` :

```bash
cd api

MARIADB_DATABASE=mawster_migrate make reset-db

MARIADB_DATABASE=mawster_migrate make create-mig MESSAGE="<MESSAGE>"

MARIADB_DATABASE=mawster_migrate make migrate
```

## Après la migration

Lire et afficher le fichier généré dans `api/alembic/versions/` pour que l'utilisateur puisse le valider.

Une fois validé, proposer d'appliquer sur la DB de dev :

```bash
cd api
make migrate
```

## Important

- Ne jamais utiliser `make reset-db` sans `MARIADB_DATABASE=mawster_migrate` — ça écrase la DB de dev
- Si `mawster_migrate` n'existe pas encore, la créer manuellement une fois : `CREATE DATABASE mawster_migrate;`
