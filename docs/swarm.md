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

## Migration de base de données

```bash
# Lancer la migration en one-shot (avant chaque deploy si schéma modifié)
docker service create --name mawster-migrate --network internal --secret mawster_db_password --secret mawster_db_root_password -e MARIADB_USER=mawster -e MARIADB_PORT=3306 -e MARIADB_DATABASE=mawster -e MODE=prod --restart-condition none sneaxiii/mawster-api:latest sh migrate.sh

# Attendre la fin de la migration
timeout 120 bash -c 'until [ "$(docker service ls --filter name=mawster-migrate --format "{{.Replicas}}")" = "0/1" ]; do sleep 2; done'

# Nettoyer le service de migration
docker service rm mawster-migrate
```

## Rollback

```bash
# Rollback manuel d'un service vers la version précédente
docker service rollback mawster_api
docker service rollback mawster_front
```

## Secrets

```bash
# Lister les secrets
docker secret ls

# Créer un secret depuis stdin
echo "ma_valeur_secrete" | docker secret create nom_du_secret -

# Créer depuis un fichier
docker secret create mawster_rclone_conf ~/.config/rclone/rclone.conf

# Supprimer un secret (impossible si utilisé par un service actif)
docker secret rm nom_du_secret

# Rotation d'un secret (les secrets sont immuables) :
# 1. Créer la nouvelle version
echo "nouvelle_valeur" | docker secret create mawster_secret_key_v2 -
# 2. Mettre à jour stack-app.yaml pour référencer mawster_secret_key_v2
# 3. docker stack deploy → rolling update avec le nouveau secret
# 4. docker secret rm mawster_secret_key (ancienne version)
```

## Tunnels SSH

Les ports internes Swarm ne sont pas exposés à l'hôte. Utiliser un tunnel SSH depuis votre machine locale (`-N` = pas de shell, tunnel uniquement).

### Base de données

```bash
ssh -L 3306:mariadb:3306 root@mawster.app -N
# Puis connecter avec n'importe quel client MariaDB sur localhost:3306
mysql -h 127.0.0.1 -P 3306 -u mawster -p mawster
```

### Grafana

```bash
ssh -L 3000:127.0.0.1:3000 root@mawster.app -N
# Ouvrir http://localhost:3000
```

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

```bash
# Forcer un backup immediatement
make backup-now

# Voir les logs du backup
docker service logs -f mawster_backup

# Lister les backups locaux
make backup-list
```

## Rebuild et push des images (depuis la machine de dev)

```bash
# API
docker build -t sneaxiii/mawster-api:latest -f api/api.Dockerfile ./api
docker push sneaxiii/mawster-api:latest

# Front
docker build -t sneaxiii/mawster-front:latest --build-arg NEXT_PUBLIC_API_CLIENT_HOST=https://www.mawster.app -f front/front.Dockerfile ./front
docker push sneaxiii/mawster-front:latest

# Backup
docker build -t sneaxiii/mawster-backup:latest -f backup/Dockerfile ./backup
docker push sneaxiii/mawster-backup:latest
```
