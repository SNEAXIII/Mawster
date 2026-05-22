---
name: commit
description: Use when ready to commit changes — analyzes git status and diff, groups changes by responsibility, creates separate conventional commits in the right order with Co-Authored-By trailer.
---

# Git Commit

Analyze changes, group by responsibility, commit with conventional messages.

## Process

1. `git status` + `git diff` pour voir tous les changements
2. Identifier les changements non liés à la feature principale → commits séparés
3. Commiter chaque groupe dans le bon ordre (fixes avant features)
4. Vérifier que chaque commit passe le pre-commit hook avant de continuer

## Conventional Commit Types

| Prefix | Quand |
|--------|-------|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `refactor:` | Changement sans effet de bord |
| `test:` | Ajout ou mise à jour de tests |
| `docs:` | Documentation uniquement |
| `chore:` | Dépendances, config, tooling |
| `style:` | Formatage, pas de logique |

## Règles

- **Jamais** `git add .` ou `git add -A` — toujours des fichiers spécifiques
- **Commits séparés** pour les changements sans lien entre eux
- Vérifier les fichiers sensibles avant staging (`.env`, `*.key`, secrets)

## Template

```bash
git add path/to/file1 path/to/file2
git commit -m "type: description courte"
```

## Groupement

- Fichiers i18n → même commit que la feature qui les requiert
- `package.json` + `package-lock.json` → même commit que la feature qui installe la dépendance
- Bug fix trouvé en chemin → commit séparé **avant** la feature
- Changements visuels sans lien → commit séparé `fix:` ou `style:`
