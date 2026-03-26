Relance uniquement les tests Cypress qui ont échoué précédemment.

## Étapes

1. **Récupérer les specs échouées** depuis les résultats du dernier run (champs `spec` ou `file` des tests échoués).
2. **Relancer** : appeler `mcp__cypress-runner__run_parallel` avec le paramètre `spec_files` = liste des chemins courts (relatifs à `front/cypress/e2e/`). Ex : `["war/basic.cy.ts", "war/operations.cy.ts"]`.
3. Reporter les résultats.
