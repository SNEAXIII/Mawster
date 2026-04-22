# Docker Secrets

Les secrets Swarm sont immuables — ils ne peuvent pas être modifiés, seulement remplacés.

## Gestion courante

```bash
# Lister les secrets
docker secret ls

# Créer depuis stdin
echo "ma_valeur" | docker secret create nom_du_secret -

# Créer depuis un fichier
docker secret create mawster_rclone_conf ~/.config/rclone/rclone.conf

# Supprimer (impossible si utilisé par un service actif)
docker secret rm nom_du_secret
```

## Rotation d'un secret

```bash
# 1. Créer la nouvelle version
echo "nouvelle_valeur" | docker secret create mawster_secret_key_v2 -

# 2. Mettre à jour la référence dans stack-app.yaml
#    secrets: mawster_secret_key → mawster_secret_key_v2

# 3. Redéployer (rolling update avec le nouveau secret)
docker stack deploy --with-registry-auth --resolve-image always -c stack-app.yaml mawster

# 4. Supprimer l'ancienne version
docker secret rm mawster_secret_key
```
