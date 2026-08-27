---
name: test-e2e
description: Use when running Cypress E2E tests — full suite or targeted specs. Always use this instead of calling cypress directly.
---

# E2E Tests

**Point d'entrée unique** : `scripts/e2e_parallel.py` — le même runner que la CI. Il build le
front (`.next-e2e`), démarre un backend + un front par worker (ports `8010+N` / `3010+N`,
DB `mawster_test_N`), lance Cypress, puis nettoie.

Ne jamais appeler `npx cypress run` directement : sans la stack montée par le script,
les specs échouent sur des timeouts au lieu de tester quoi que ce soit.

**Prérequis** : Docker avec `mariadb-test` accessible sur **3307**.

```bash
docker compose -f compose-dev.yaml up -d mariadb-test
```

## Specs ciblées (à privilégier en local)

`--spec` accepte une liste séparée par des virgules, relative à `front/cypress/e2e/` ;
un dossier est développé en toutes ses specs.

```bash
python3 scripts/e2e_parallel.py --spec "war/basic.cy.ts,roster/roster.cy.ts" --quiet
```

Maximum 3 fichiers par batch. Au-delà, grouper et lancer batch par batch en attendant
les résultats entre chaque.

## Suite complète

```bash
python3 scripts/e2e_parallel.py --workers 4 --quiet
```

Long — préférer les specs ciblées en local et laisser la CI faire la passe complète.

## Options utiles

| Option | Effet |
|--------|-------|
| `--workers N` | 1 à 8 workers parallèles (défaut 2 ; `--spec` force le nombre de specs) |
| `--quiet` | Masque les logs backend/front, garde la sortie Cypress |
| `--skip-build` | Réutilise le `.next-e2e` existant — seulement si le front n'a pas bougé |
| `--include-vision` | Inclut les specs vision (exclues par défaut : elles exigent RabbitMQ + RustFS + un worker vision) |

## Si des tests échouent

1. Récupérer le `spec` de chaque test en échec dans la sortie
2. Relancer uniquement ces specs :

```bash
python3 scripts/e2e_parallel.py --spec "war/basic.cy.ts"
```

Artefacts dans `front/cypress/results/` (rapports XML, screenshots d'échec). Comparer leur
`mtime` à l'heure du run : un run qui n'a produit aucun nouveau fichier n'a rien exécuté.

## Conventions E2E du projet

- `beforeEach(() => { cy.truncateDb(); })` dans chaque `describe`
- Sélecteurs : `data-cy` + `cy.getByCy('...')` — jamais de classes CSS ou de texte
- Confirmation dialog : `data-cy='confirmation-dialog-confirm'`
- Admin endpoints → toujours `adminData.access_token`, jamais `ownerData.access_token`
