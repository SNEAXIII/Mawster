---
name: resolve-local-imports
description: >
  Use when ruff reports PLC0415 ("`import` should be at the top-level of a file"), when `make
  check` / `make fix` fails on an import nested in a function, when adding a `# noqa: PLC0415`, or
  to remonter / hoister des imports locaux dans `api/`.
---

# Resolve Local Imports

## Overview

Un import local qui déclenche `PLC0415` a **deux issues également valables** : le remonter en tête de module, ou le garder et documenter pourquoi. Le linter ne sait pas laquelle est la bonne — c'est un arbitrage.

**Ne jamais trancher seul. Demander au user avant d'écrire quoi que ce soit.**

## Où la règle est active

Le périmètre est déjà décidé dans la config — le relire avant d'agir, pas le déduire.

| Chemin | `PLC0415` | Pourquoi |
| --- | --- | --- |
| `api/main.py` | **off** | la pile de messagerie est montée dans le lifespan, pas au moment de l'import |
| `api/src/**`, `api/tests/**` | **on** | les imports appartiennent en tête de module |
| `static-assets/**` | **off** | deps optionnelles (PIL, bs4, curl_cffi) importées dans la fonction qui les utilise |
| `scripts/**`, `.claude/**` | on | |

Sources : `ruff.toml` (racine) et `[tool.ruff.lint.per-file-ignores]` dans `api/pyproject.toml`.

## Workflow

1. **Voir ce que ruff reproche vraiment**
   ```bash
   cd api && uvx ruff check --select PLC0415
   ```
2. **Dry-run cadré sur le même périmètre** (jamais plus large)
   ```bash
   python3 .claude/skills/resolve-local-imports/hoist_imports.py api
   ```
   Les deux totaux doivent coïncider. S'ils divergent, le `--dirs` est faux — le corriger avant de continuer.
3. **Demander au user** avec `AskUserQuestion`, une fois pour le lot (pas par import), en donnant les chiffres : combien de fichiers, combien d'imports, et lesquels ont l'air délibérés.
4. **Appliquer le choix** (voir ci-dessous).
5. **Vérifier** : `make format` → `make check` → `make test`. Le vert du linter ne suffit pas ; seuls les tests exécutent réellement les imports remontés.

## Les deux issues

**Remonter** — `python3 .claude/skills/resolve-local-imports/hoist_imports.py api --apply`
Le script travaille sur l'AST : indentation imbriquée, `import x` comme `from x import y`, et imports parenthésés multi-lignes.

**Garder et documenter** — au choix :
- ligne isolée → `# noqa: PLC0415` suivi de la raison sur la même ligne
- famille de fichiers → entrée dans `[tool.ruff.lint.per-file-ignores]` de `api/pyproject.toml`

Convention du repo : **tout `ignore` porte un commentaire qui dit pourquoi**. Un ignore nu se fait refuser en review.

## Ce que le script laisse toujours en place

- les imports dans un bloc `if TYPE_CHECKING:` — c'est leur raison d'être
- un import seul statement de son bloc (le retirer laisserait un corps vide)
- tout fichier dont le résultat ne re-parse pas : il est signalé, pas écrit

## Common mistakes

| Erreur | Réalité |
| --- | --- |
| Remonter dans un chemin où ruff désactive la règle | Le dry-run ignore la config ruff. Cadrer avec `--dirs`, et vérifier que les deux totaux coïncident. |
| Lancer `--apply` puis montrer le résultat | Le choix se demande avant l'écriture, pas après. |
| Ajouter un `noqa` sans justification | Chaque ignore du repo porte sa raison. |
| S'arrêter à `make check` au vert | `PLC0415` est statique. `make test` est la vérification. |
