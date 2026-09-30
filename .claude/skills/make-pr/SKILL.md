---
name: make-pr
description: >
  Ouvre la PR d'une branche de feature sur la branche par défaut : commit, push, `gh pr create`.
  Jamais pour promouvoir la branche par défaut vers une branche de release ou de staging.
user-invocable: true
---

# Make PR

Workflow complet pour ouvrir une PR sur la branche par défaut depuis la branche courante.
`<base>` = `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.

## Steps

1. **Commit** tout ce qui est staged avec un message conventionnel (`feat:`, `fix:`,
   `refactor:`, etc.) et le co-author Claude.

2. **Push** la branche vers origin :
   ```bash
   git push -u origin <branch>
   ```

3. **Créer la PR** via le CLI `gh` :
   ```bash
   gh pr create --base <base> --head <branch> --title "<titre>" --body ""
   ```
   - Body vide ou minimal — pas de sections Summary / Test plan.
   - Si `gh` répond `HTTP 401: Bad credentials`, demander à l'utilisateur de lancer
     `gh auth login` puis relancer la commande.

## Args

Si des args sont fournis (ex: `/make-pr fix login redirect`), les utiliser comme titre de PR.  
Sinon, dériver le titre depuis les commits de la branche (`git log <base>..HEAD --oneline`).

## Notes

- Si rien n'est staged et qu'il n'y a pas de diff, signaler à l'utilisateur et s'arrêter.
- Ne jamais forcer un push (`--force`).
- Pas de lint ni de format à la main : les hooks pre-commit du repo s'en chargent au commit.
