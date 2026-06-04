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

Toutes les commandes s'exécutent depuis `api/` avec `MARIADB_DATABASE=mawster_migrate`.

**Garder la sortie hors du contexte** : Alembic (`create-mig`, `migrate`) crache toute la réflexion de schéma + le SQL. Exécuter ces commandes via `ctx_execute(language: "shell", code: "...")` plutôt qu'avec Bash — seule une synthèse rentre dans le contexte.

```bash
cd api && MARIADB_DATABASE=mawster_migrate make reset-db

cd api && MARIADB_DATABASE=mawster_migrate make create-mig MESSAGE="<MESSAGE>"

cd api && MARIADB_DATABASE=mawster_migrate make migrate
```

## Après la migration

Pour la review, **ne pas faire un `Read` complet** du fichier généré (boilerplate `upgrade`/`downgrade` + chaque colonne). Extraire seulement les opérations réelles :

```bash
grep -nE "op\.|sa\.Column" api/alembic/versions/<dernier_fichier>.py
```

Afficher ces lignes à l'utilisateur. Ne `Read` le fichier entier que s'il faut l'éditer.

Une fois validé, proposer d'appliquer sur la DB de dev :

```bash
cd api
make migrate
```

## Important

- Ne jamais utiliser `make reset-db` sans `MARIADB_DATABASE=mawster_migrate` — ça écrase la DB de dev
- Si `mawster_migrate` n'existe pas encore, la créer manuellement une fois : `CREATE DATABASE mawster_migrate;`
