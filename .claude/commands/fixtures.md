Charge les fixtures depuis `.//api`.

## Actions selon $ARGUMENTS

| Argument | Commande make | Description |
|----------|---------------|-------------|
| (vide) | `make fixtures` | Charge toutes les données de dev (sample_data) |
| `champions` | `make load-champions` | Charge les champions depuis scripts/champions.json |
| `init` | `make init-db` | Init minimale prod (1 user + base BDD) |

## Étapes

1. Se placer dans `.//api`
2. Exécuter la commande correspondante
3. Afficher le résultat :
   - Succès → confirmer ce qui a été chargé
   - Erreur de contrainte/doublon → proposer un `make reset-db` si pertinent
   - DB non migrée → suggérer `/migrate` d'abord
