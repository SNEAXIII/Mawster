# RustFS — Télécharger des objets

Récupère les objets récents d'un bucket (`vision` : screenshots + crops d'import) sans jamais afficher les
clés : elles restent dans l'environnement du shell distant, et `-e NOM` sans valeur les passe à rclone.

## Sur le serveur

```bash
ssh root@mawster.app
```

```bash
RC=$(docker ps -q -f name=mawster_rustfs.1)
export RCLONE_CONFIG_RFS_TYPE=s3 RCLONE_CONFIG_RFS_PROVIDER=Other RCLONE_CONFIG_RFS_ENDPOINT=https://s3.mawster.app
export RCLONE_CONFIG_RFS_ACCESS_KEY_ID="$(docker exec "$RC" cat /run/secrets/mawster_rustfs_access_key)"
export RCLONE_CONFIG_RFS_SECRET_ACCESS_KEY="$(docker exec "$RC" cat /run/secrets/mawster_rustfs_secret_key)"
ENVS="-e RCLONE_CONFIG_RFS_TYPE -e RCLONE_CONFIG_RFS_PROVIDER -e RCLONE_CONFIG_RFS_ENDPOINT -e RCLONE_CONFIG_RFS_ACCESS_KEY_ID -e RCLONE_CONFIG_RFS_SECRET_ACCESS_KEY"

# Aperçu
docker run --rm $ENVS rclone/rclone ls rfs:vision --max-age 5h --use-server-modtime

# Téléchargement
docker run --rm $ENVS -v /tmp/rustfs-dump:/out rclone/rclone copy rfs:vision /out --max-age 5h --use-server-modtime -P
exit
```

- `--max-age` : `30m`, `5h`, `2d`… `--use-server-modtime` filtre sur la date d'upload sans un HEAD par objet.
- Un seul import : `rfs:vision/imports/<import_id>`. Le dataset : `rfs:dataset`.
- `RC` vide → `docker ps --format '{{.Names}}' | grep rustfs` donne le vrai nom du conteneur.

## En local

```powershell
scp -r root@mawster.app:/tmp/rustfs-dump ./rustfs-dump
ssh root@mawster.app rm -rf /tmp/rustfs-dump
```

Réf. : [rclone filtering](https://rclone.org/filtering/), [rclone S3](https://rclone.org/s3/).
