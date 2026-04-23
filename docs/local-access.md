# Local Access — SSH Tunnels

Tunnels SSH pour accéder aux services depuis la machine locale (`-N` = tunnel uniquement, pas de shell).

## Base de données (MariaDB)

```bash
ssh -L 3306:127.0.0.1:3306 root@mawster.app -N
# Puis connecter sur localhost:3306
mysql -h 127.0.0.1 -P 3306 -u mawster -p mawster
```

## Grafana

```bash
ssh -L 4500:127.0.0.1:4500 root@mawster.app -N
# Ouvrir http://localhost:4500
```
