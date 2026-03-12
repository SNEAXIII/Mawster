Lance les tests backend depuis `/home/alexis.bassignot/Desktop/work/Mawster/api`.

## Étapes

1. Se placer dans `/home/alexis.bassignot/Desktop/work/Mawster/api`
2. Lancer :
   ```
   uv run pytest tests -v --tb=short -n 6 -q $ARGUMENTS
   ```
3. Analyser le résultat :
   - Tous les tests passent → confirmer brièvement
   - Tests échouent → afficher les erreurs, identifier la cause, proposer un fix
   - Erreur de setup (import, env, DB) → le signaler clairement

## Notes
- `$ARGUMENTS` permet de cibler un sous-dossier ou fichier, ex: `tests/unit/service/`
- Ne pas modifier les tests sans que l'utilisateur le demande
- Les tests `xfail`/`skip` ne sont pas des échecs
