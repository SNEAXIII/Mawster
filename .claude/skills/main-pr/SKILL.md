---
name: main-pr
description: >
  Ouvre la PR d'une branche de feature sur `main` : ruff lint/format, commit, push, `gh pr create`.
  Jamais pour promouvoir `main` vers `release` ou `staging` — pour déployer, voir `release-pr`.
user-invocable: true
---

# Main PR

Workflow complet pour ouvrir une PR sur `main` depuis la branche courante.

Pour promouvoir `main` vers `release` (prod) ou `staging` et déployer, c'est `/release-pr`.

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

5. **Créer la PR** via le CLI `gh` :
   ```bash
   gh pr create --base main --head <branch> --title "<titre>" --body ""
   ```
   - Body vide ou minimal — pas de sections Summary / Test plan.
   - Si `gh` répond `HTTP 401: Bad credentials`, demander à l'utilisateur de lancer
     `gh auth login` puis relancer la commande.

## Args

Si des args sont fournis (ex: `/main-pr fix login redirect`), les utiliser comme titre de PR.  
Sinon, dériver le titre depuis les commits de la branche (`git log main..HEAD --oneline`).

## Notes

- Si rien n'est staged et qu'il n'y a pas de diff, signaler à l'utilisateur et s'arrêter.
- Ne jamais forcer un push (`--force`).
- Ruff peut ne modifier aucun fichier — c'est normal, continuer quand même.
