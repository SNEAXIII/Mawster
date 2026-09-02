---
name: commit
description: Use when ready to commit changes, or to commit and push — analyzes git status and diff, groups changes by responsibility, creates separate conventional commits in the right order with Co-Authored-By trailer. Pass `push` to push once every commit is made, and `main` to work straight on the default branch.
model: claude-haiku-4-5-20251001
---

# Git Commit

Analyze changes, group by responsibility, commit with conventional messages.

## Arguments

| Argument | Effet |
|----------|-------|
| _(aucun)_ | Commits seulement, rien n'est poussé |
| `push` | Commits, puis `git push` une fois **tous** les commits faits |
| `main` | Commiter sur la branche courante même si c'est la branche par défaut |

Les deux se combinent : `/commit push main` commite et pousse sur `main`.

Tout autre argument est une consigne de groupement en langage naturel
(`/commit juste les tests`), pas un flag.

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
6. Si l'argument `push` est présent, pousser une seule fois, à la fin :
   `git push -u origin HEAD` (le `-u` couvre la première poussée d'une branche
   neuve et ne gêne pas les suivantes)

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

- **Toujours** commiter depuis une branche dédiée : si HEAD est sur `main`,
  créer la branche **avant** le premier commit (`git checkout -b type/sujet`).
  L'argument `main` lève cette règle : rester sur la branche courante, quelle
  qu'elle soit.
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
