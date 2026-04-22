# Database Migrations

Migrations Alembic via une image dédiée (`mawster-migrate`), lancée en job one-shot avant chaque deploy si le schéma a changé.

## Lancer une migration

```bash
docker service create \
  --name mawster-migrate \
  --network internal \
  --secret mawster_db_password \
  --secret mawster_db_root_password \
  -e MARIADB_USER=mawster \
  -e MARIADB_PORT=3306 \
  -e MARIADB_DATABASE=mawster \
  --mode replicated-job \
  sneaxiii/mawster-migrate:latest sh migrate.sh
```

## Suivre et vérifier

```bash
# Logs en temps réel
docker service logs -f mawster-migrate

# Résultat : Complete = succès, Failed = échec
docker service ps mawster-migrate --format "{{.CurrentState}}"

# Nettoyer
docker service rm mawster-migrate
```

## Rebuild de l'image

```bash
docker build -t sneaxiii/mawster-migrate:latest -f api/migrate.Dockerfile api/
docker push sneaxiii/mawster-migrate:latest
```
