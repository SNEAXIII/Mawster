# Local Access — SSH Tunnels

Tunnels SSH pour accéder aux services depuis la machine locale (`-N` = tunnel uniquement, pas de shell).

## Base de données (PostgreSQL)

Port local 15432 : le 5432 est déjà pris par `postgres-dev`.

```bash
ssh -L 15432:127.0.0.1:5432 root@mawster.app -N
# Puis connecter sur localhost:15432
psql -h 127.0.0.1 -p 15432 -U mawster mawster
```

## Grafana

```bash
ssh -L 4500:127.0.0.1:4500 root@mawster.app -N
# Ouvrir http://localhost:4500
```
