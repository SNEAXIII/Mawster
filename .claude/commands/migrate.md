Gère les migrations Alembic depuis `/home/alexis.bassignot/Desktop/work/Mawster/api`.

## Actions selon $ARGUMENTS

| Argument | Commande make | Description |
|----------|---------------|-------------|
| (vide) | `make migrate` | Applique toutes les migrations en attente |
| `create <message>` | `make create-mig MIGRATION_MESSAGE="<message>"` | Crée une migration autogénérée |
| `cancel` | `make cancel-last` | Annule la dernière migration |
| `reset` | `make reset-db` | ⚠️ Remet la DB à zéro |

## Étapes

1. Se placer dans `/home/alexis.bassignot/Desktop/work/Mawster/api`
2. Si `reset` → demander confirmation avant d'exécuter
3. Exécuter la commande correspondante
4. Afficher le résultat :
   - Succès → confirmer les migrations appliquées
   - Erreur → afficher le message, identifier la cause
   - Après `create` → rappeler de relire le fichier généré avant d'appliquer
