# Docker Swarm — Commandes utiles

## Déploiement

```bash
# Déployer / mettre à jour le stack app
docker stack deploy --with-registry-auth --resolve-image always -c stack-app.yaml mawster

# Déployer / mettre à jour le stack observabilité
docker stack deploy --with-registry-auth --resolve-image always -c stack-obs.yaml mawster-obs

# Forcer le pull des dernières images avant deploy
docker pull sneaxiii/mawster-api:latest
docker pull sneaxiii/mawster-front:latest
docker pull sneaxiii/mawster-backup:latest
```

## État des services

```bash
# Lister tous les services et leur état (replicas)
docker service ls

# Détail d'un service (image, placement, ports…)
docker service inspect mawster_api --pretty

# Voir les tâches (conteneurs) d'un service
docker service ps mawster_api
docker service ps mawster_front

# Voir les tâches en erreur seulement
docker service ps mawster_api --filter desired-state=shutdown
```

## Logs

Voir [`docs/logs.md`](logs.md).

## Migration de base de données

Voir [`docs/migration.md`](migration.md).

## Rollback

```bash
# Rollback manuel d'un service vers la version précédente
docker service rollback mawster_api
docker service rollback mawster_front
```

## Secrets

Voir [`docs/secrets.md`](secrets.md).

## Tunnels SSH

Voir [`docs/local-access.md`](local-access.md).

## Réseau

Les réseaux sont déclarés `external: true` dans `stack-app.yaml` — ils doivent être créés manuellement **avant** le premier `docker stack deploy`. Ils n'ont donc pas de préfixe de stack.

```bash
# Créer les réseaux (une seule fois, à l'initialisation du cluster)
docker network create --driver overlay --attachable internal
docker network create --driver overlay --attachable traefik-public

# Lister les réseaux overlay
docker network ls --filter driver=overlay

# Inspecter un réseau (voir quels services y sont attachés)
docker network inspect internal
docker network inspect traefik-public
```

## Nœuds Swarm

```bash
# Lister les nœuds du cluster
docker node ls

# Infos détaillées sur un nœud
docker node inspect self --pretty
```

## Arrêt d'urgence

```bash
# Scaler un service à 0 (l'arrêter sans supprimer le stack)
docker service scale mawster_api=0
docker service scale mawster_front=0

# Supprimer un stack entier
docker stack rm mawster
docker stack rm mawster-obs
```

## Backup

Voir [`docs/backup.md`](backup.md).

## Rebuild et push des images

Voir [`docs/images.md`](images.md).
