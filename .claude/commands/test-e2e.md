Lance les tests E2E complets — démarre automatiquement le mode test si besoin, puis Cypress. Ne jamais appeler `/server-test` avant (double redémarrage inutile).

## Étapes

1. **Vérifier le mode serveur** : appeler `mcp__server-runner__status`.
   - Le status retourne maintenant `{ dev: {...}, test: {...} }`.
   - Si `status.dev.alive?.api === true` **ET** `status.test.running === false` : **STOP** — avertir l'utilisateur que seuls les serveurs **dev** sont actifs et que les E2E tourneraient sur la mauvaise base de données. Lui proposer de lancer `/server-test` (les deux peuvent coexister) puis relancer `/test-e2e`.
   - Sinon : continuer.

2. **Lancer les E2E** : appeler `mcp__server-runner__run_e2e` et reporter les résultats.
