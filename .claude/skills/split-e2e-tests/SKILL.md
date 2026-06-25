---
name: split-e2e-tests
description: Use when Cypress E2E spec files have grown too big (many it() blocks mixing several concerns) and need splitting into smaller, purpose-focused files — and when you need to verify a split stayed coherent (no test lost, no duplicate, setup preserved). Triggers on "split the e2e tests", "this cy.ts file is too big", "which specs are the largest", "découper les tests e2e", "vérifier la cohérence des tests".
user-invocable: true
---

# Split E2E Tests

Découper les gros fichiers `*.cy.ts` en fichiers plus petits et **regroupés par
objectif**, puis prouver que la découpe n'a rien cassé.

Un gros spec n'est pas juste « trop long » : il mélange plusieurs objectifs de
test (ex. permissions, affichage, erreurs de planning…). On le découpe le long
de ces lignes de fracture, en sous-dossier quand les objectifs divergent
vraiment — pas en chunks numérotés arbitraires.

> **Interpréteur** : `python3` sous Linux/macOS, `python` sous Windows.
> Les exemples utilisent `python3` — remplace par `python` sur Windows.

## Contrainte projet

**Ne jamais lancer Cypress en local.** L'utilisateur valide les specs en CI
(pipeline). Ici on vérifie la cohérence statiquement (scripts ci-dessous) et la
compilation (`tsc`/build). On laisse l'exécution réelle des tests à la CI.

## Workflow

### 1. Repérer les candidats

```bash
python .claude/skills/split-e2e-tests/scripts/count_tests.py front/cypress/e2e --top 15
```

Classe les specs par nombre de `it()`, avec barres et seuil (défaut 15). Les
fichiers `⚠ split` sont les candidats. Cible un seul fichier à la fois.

### 2. Comprendre les objectifs avant de couper

Lis le fichier candidat et **note son compte de `it()`** (il sert de garde-fou).
Regroupe mentalement les `it()` par intention. Indices de lignes de fracture :

- des `describe()` distincts → frontière naturelle, un fichier par describe ;
- un même describe qui mêle des préoccupations (happy path vs erreurs vs
  permissions) → sépare par préoccupation ;
- des setups (`beforeEach`, helpers `setup*`) différents → signal fort que ce
  sont deux objectifs différents.

Si les objectifs divergent nettement, crée un **sous-dossier** portant le nom du
domaine (ex. `war/synergy/`) et répartis-y les fichiers. Si c'est juste une
question de volume sur un objectif unique, garde les fichiers à côté avec des
noms parlants (`war-attackers-filters.cy.ts`, `war-attackers-counts.cy.ts`).

### 3. Découper

Pour chaque nouveau fichier :

- copie **les imports nécessaires** depuis l'original (helpers `from
  '../../support/e2e'`, etc.) — n'embarque que ceux réellement utilisés ;
- copie le `beforeEach(() => { cy.truncateDb(); })` — chaque fichier doit
  repartir d'une base propre (convention projet) ;
- déplace les `it()` du groupe, sans réécrire leur logique ;
- donne au `describe()` un titre qui reflète l'objectif du fichier.

Supprime l'original une fois tous ses `it()` redistribués.

### 4. Vérifier la cohérence

```bash
python .claude/skills/split-e2e-tests/scripts/verify_split.py \
  --original <chemin/original.cy.ts> <nouveaux-fichiers...>
```

Si l'original est déjà supprimé, utilise `--expected <N>` (le compte noté à
l'étape 2). Le script échoue (exit ≠ 0) si :

- **le compte de `it()` ne se conserve pas** (test perdu ou dupliqué) ;
- **des titres `describe::it` sont dupliqués** (fuite de copier-coller) ;
- **un fichier n'a pas `beforeEach(... truncateDb)`** (état sale).

### 5. Compilation / lint

Vérifie que les fichiers générés compilent et que les imports tiennent :

```bash
cd front && npm run build      # attrape les erreurs TS / imports cassés
```

Ne lance **pas** la suite Cypress en local — laisse la CI exécuter les specs.

## Critères de réussite

- `verify_split.py` renvoie `SPLIT OK` ;
- `npm run build` passe ;
- chaque nouveau fichier a un objectif clair, lisible dans son nom et le titre
  de son `describe()` ;
- aucune logique de test modifiée — uniquement déplacée et regroupée.
