---
name: commit
description: Use when ready to commit changes — analyzes git status and diff, groups changes by responsibility, creates separate conventional commits in the right order with Co-Authored-By trailer.
model: claude-haiku-4-5-20251001
---

# Git Commit

Analyze changes, group by responsibility, commit with conventional messages.

## Process

1. **Vue d'ensemble légère d'abord** — jamais `git diff` brut complet :
   - `git status --short`
   - `git diff --stat` (aperçu fichiers + volume, sans charger le contenu)
2. Diff ciblé **seulement si nécessaire** pour décider du groupement :
   - `git diff -- <fichier>` sur un fichier précis, pas tout le working tree
   - Garder les gros diffs hors de la fenêtre : passer par
     `ctx_execute(language: "shell", code: "git diff -- <fichier>")`
     plutôt que de lire le diff brut directement
3. Identifier les changements non liés à la feature principale → commits séparés
4. Commiter chaque groupe dans le bon ordre (fixes avant features)
5. Vérifier que chaque commit passe le pre-commit hook avant de continuer

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
