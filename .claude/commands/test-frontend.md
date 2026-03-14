Lance les tests Cypress depuis `/home/alexis.bassignot/Desktop/work/Mawster/front`.

## Étapes

1. Se placer dans `/home/alexis.bassignot/Desktop/work/Mawster/front`
2. Lancer :
   - Tous les tests : `npm run cypress:run`
   - Fichier ciblé : `npm run cypress:run -- --spec "cypress/e2e/$ARGUMENTS"`
3. Analyser le résultat :
   - Tous passent → confirmer brièvement
   - Échecs → afficher les étapes échouées, identifier la cause (sélecteur manquant, data-cy absent, API down)
   - Serveur non lancé → rappeler que `npm run testing` (port 3000) doit tourner

## Notes

- Le frontend doit être démarré avec `npm run testing`
- L'API backend doit être disponible sur le port 8001
- Commandes custom Cypress dans `cypress/support/e2e.ts`
- Ne pas modifier les tests sans que l'utilisateur le demande
