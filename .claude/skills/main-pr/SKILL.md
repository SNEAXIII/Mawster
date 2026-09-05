---
name: main-pr
description: >
  Ouvre la PR d'une branche de feature sur `main` : commit, push, `gh pr create`.
  Jamais pour promouvoir `main` vers `release` ou `staging` — pour déployer, voir `release-pr`.
user-invocable: true
---

# Main PR

Workflow complet pour ouvrir une PR sur `main` depuis la branche courante.

Pour promouvoir `main` vers `release` (prod) ou `staging` et déployer, c'est `/release-pr`.

## Steps

1. **Commit** tout ce qui est staged avec un message conventionnel (`feat:`, `fix:`,
   `refactor:`, etc.) et le co-author Claude.

2. **Push** la branche vers origin :
   ```bash
   git push -u origin <branch>
   ```

3. **Créer la PR** via le CLI `gh` :
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
- **Pas d'étape ruff ici** : `.pre-commit-config.yaml` lance `ruff` et `ruff-format`
  sur les fichiers stagés à chaque commit. La relancer à la main ne ferait que
  dupliquer le travail des hooks. Si un commit passe avec `--no-verify`, c'est la CI
  qui rattrape.
