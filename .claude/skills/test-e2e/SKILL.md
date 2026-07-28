---
name: test-e2e
description: Use when running Cypress E2E tests — full suite or targeted specs. Always use this instead of calling cypress directly.
---

# E2E Tests

**Outil unique** : `mcp__server-runner__run_e2e` — il démarre la stack test si besoin (MariaDB-test 3307 + API 8001 + Front 3001), puis lance Cypress.

Le MCP `cypress-runner` a été supprimé : il servait des rapports périmés, donc un
« passing » pouvait être faux. Plus de run parallèle sur plusieurs workers.

## Paramètres

| Paramètre | Valeur |
|-----------|--------|
| `spec_files` | Liste de specs ciblées (chemins relatifs à `front/cypress/e2e/`). Omis = toutes les specs. |

## Lancer tous les tests

```
mcp__server-runner__run_e2e()
```

Long — la suite complète tourne en série. Préférer les specs ciblées en local et
laisser la CI faire la passe complète.

## Lancer des specs ciblées

Maximum 3 fichiers par batch. Si plus de 3 specs, les grouper et lancer batch par
batch en attendant les résultats entre chaque.

```
mcp__server-runner__run_e2e(spec_files=["war/basic.cy.ts", "roster/foo.cy.ts"])
```

## Si des tests échouent

1. Récupérer les `spec` des tests échoués dans les résultats
2. Relancer uniquement ces specs :

```
mcp__server-runner__run_e2e(spec_files=["war/basic.cy.ts"])
```

## Vérifier qu'un résultat est frais

L'ancien runner mentait sur ce point. Avant de croire un vert :

- Les artefacts sont dans `front/cypress/results/` — comparer leur `mtime` à l'heure du run
- Un run qui n'a produit aucun nouveau fichier n'a rien exécuté

## Conventions E2E du projet

- `beforeEach(() => { cy.truncateDb(); })` dans chaque `describe`
- Sélecteurs : `data-cy` + `cy.getByCy('...')` — jamais de classes CSS ou de texte
- Confirmation dialog : `data-cy='confirmation-dialog-confirm'`
- Admin endpoints → toujours `adminData.access_token`, jamais `ownerData.access_token`
