# Logs

## Services Swarm

```bash
# Logs temps réel d'un service (tous les réplicas)
docker service logs -f mawster_api
docker service logs -f mawster_front
docker service logs -f mawster_mariadb

# Dernières N lignes
docker service logs --tail 100 mawster_api

# Logs avec timestamps
docker service logs -f --timestamps mawster_api
```

## Grafana / Loki

Accéder via tunnel SSH : voir [`local-access.md`](local-access.md).

Filtres LogQL utiles :

```logql
# Logs AUDIT uniquement
{service_name="mawster_api"} |= "AUDIT"

# Logs HTTP uniquement
{service_name="mawster_api"} != "AUDIT"

# Erreurs
{service_name="mawster_api"} |= "ERROR"
```
