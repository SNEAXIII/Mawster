---
name: open-pr
description: Use when ready to open a pull request — runs ruff lint/format, commits, pushes, and creates the PR via GitHub MCP
user-invocable: true
---

# Open PR

Workflow complet pour ouvrir une PR sur `main` depuis la branche courante.

## Steps

1. **Lint + format** (depuis `api/`) :
   ```bash
   cd api && uvx ruff check --fix && uvx ruff format
   ```

2. **Stage les corrections ruff** si des fichiers ont été modifiés :
   ```bash
   git diff --name-only  # repérer les fichiers touchés par ruff
   git add <fichiers modifiés par ruff>
   ```

3. **Commit** tout ce qui est staged (modifications ruff incluses) avec un message conventionnel (`feat:`, `fix:`, `refactor:`, etc.) et le co-author Claude.

4. **Push** la branche vers origin :
   ```bash
   git push -u origin <branch>
   ```

5. **Créer la PR** via `mcp__plugin_github_github__create_pull_request` :
   - `owner` et `repo` : extraits depuis `git remote get-url origin` (ex: `git@github.com:OWNER/REPO.git` ou `https://github.com/OWNER/REPO`)
   - `head` : branche courante
   - `base` : `main`
   - Body en markdown avec sections **Summary** (bullets) et **Test plan** (checklist).

## Args

Si des args sont fournis (ex: `/open-pr fix login redirect`), les utiliser comme titre de PR.  
Sinon, dériver le titre depuis les commits de la branche (`git log main..HEAD --oneline`).

## Notes

- Si rien n'est staged et qu'il n'y a pas de diff, signaler à l'utilisateur et s'arrêter.
- Ne jamais forcer un push (`--force`).
- Ruff peut ne modifier aucun fichier — c'est normal, continuer quand même.
