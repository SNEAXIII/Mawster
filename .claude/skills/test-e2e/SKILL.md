---
name: test-e2e
description: Use when running Cypress E2E tests — full suite or targeted specs. Always use this instead of calling mcp__cypress-runner__run_parallel directly.
---

# E2E Tests

**Outil unique** : `mcp__cypress-runner__run_parallel` — jamais `mcp__server-runner__run_e2e`.

## Paramètres

| Paramètre | Valeur |
|-----------|--------|
| `spec_files` | Liste de specs ciblées (chemins relatifs à `front/cypress/e2e/`). Omis = toutes les specs. |

## Lancer tous les tests

```
mcp__cypress-runner__run_parallel()
```

## Lancer des specs ciblées

Maximum 3 fichiers par batch — la CI gère le reste. Si plus de 3 specs, les grouper et lancer batch par batch en attendant les résultats entre chaque.

**1 à 3 specs :**
```
mcp__cypress-runner__run_parallel(spec_files=["war/basic.cy.ts", "roster/foo.cy.ts"])
```

**Plus de 3 specs — lancer en batches séquentiels :**
```
# Batch 1
mcp__cypress-runner__run_parallel(spec_files=["a.cy.ts", "b.cy.ts", "c.cy.ts"])
# Attendre les résultats, puis Batch 2
mcp__cypress-runner__run_parallel(spec_files=["d.cy.ts", "e.cy.ts"])
```

## Si des tests échouent

1. Récupérer les `spec` des tests échoués dans les résultats
2. Relancer uniquement ces specs :

```
mcp__cypress-runner__run_parallel(spec_files=["war/basic.cy.ts"])
```

## Conventions E2E du projet

- `beforeEach(() => { cy.truncateDb(); })` dans chaque `describe`
- Sélecteurs : `data-cy` + `cy.getByCy('...')` — jamais de classes CSS ou de texte
- Confirmation dialog : `data-cy='confirmation-dialog-confirm'`
- Admin endpoints → toujours `adminData.access_token`, jamais `ownerData.access_token`
