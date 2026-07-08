---
name: authz-audit
description: >
  Mini-audit sécurité + tests d'un lot controller/service backend, centré sur les
  accès non autorisés (authn manquante, élévation de privilège, IDOR cross-alliance)
  et la couverture de tests correspondante. Use whenever the user wants to "check
  unauthorized access", "audit sécu d'un endpoint/service", "vérifier les droits /
  rôles", "IDOR", "accès non souhaité", "qui peut faire quoi", or before shipping a
  new alliance/war endpoint and worrying about who can call it — even without the
  word "audit". Reports findings; the user approves before any fix.
user-invocable: true
---

# Audit accès non autorisés (controller + service)

But : prouver qu'un lot backend n'expose **aucun accès non voulu** — pas d'endpoint
sans auth, pas d'élévation de privilège, pas d'IDOR entre alliances — **et** que les
tests verrouillent ce comportement. Le skill **rapporte** ; l'utilisateur approuve
avant toute correction ou écriture de test.

Modèle de rôles du projet (hiérarchique) : `owner ⊃ officer ⊃ member ⊃ visitor`.
Un `User` peut posséder plusieurs `GameAccount`, chacun rattaché à **une** alliance.
Toute l'autorisation vit dans les **services** (`require_owner` / `require_officer` /
`require_member` / `_assert_*`), les controllers restent fins.

## Workflow

### 1. Choisir (ou recevoir) le lot
Un couple `controllers/<domaine>/<x>_controller.py` + le(s) `services/.../<X>Service.py`
qu'il appelle. Si l'utilisateur ne précise pas, privilégier le domaine le plus sensible
aux droits (membres, officiers, ownership, défense/war). Lister les endpoints et leur
verbe/chemin.

### 2. Cartographier les gardes (tableau endpoint → garde)
Pour **chaque** endpoint, remplir trois colonnes :

1. **Authn** — le routeur porte-t-il `dependencies=[Depends(AuthService.get_current_user_in_jwt)]`
   (ou le param `current_user`) ? Sinon → accès anonyme = finding critique.
2. **Garde de rôle** — `require_owner` / `require_officer` / `_assert_can_*` appelé
   avant la mutation ? La bonne garde pour l'action (ex. ajouter un officier = owner
   only) ?
3. **Garde cross-alliance (service)** — la méthode service **re-vérifie**-t-elle que
   la cible (`game_account_id`, `war_id`, `node`…) appartient bien à `alliance_id` ?
   Chercher `assert_is_alliance_member`, un filtre `WHERE alliance_id ==`, ou un test
   `x.alliance_id != alliance_id`. **Son absence = IDOR** (agir sur les données d'une
   autre alliance via un id deviné).

### 3. Vérifier les invariants sensibles
- Owner intouchable : pas de removal/downgrade de l'owner (attendu 400/403, pas 500).
- Officier ne peut pas agir sur un autre officier quand la règle l'interdit
  (`_assert_can_remove_member`).
- Cohérence des codes : alliance inexistante → **404** partout (non-divulgation), pas
  un mélange 403/404/500 selon l'endpoint.
- Une garde booléenne (`is_owner`) sur alliance absente doit renvoyer `False`, jamais
  crasher.

### 4. Auditer la couverture de tests
Ouvrir le(s) `*_test.py` du lot et confronter aux gardes. Pour chaque endpoint, chaque
ligne du tableau devrait avoir un test. Les manques typiques (à signaler comme findings
"test-gap") :
- **IDOR cross-alliance** : viser un id d'une **autre** alliance → 404. Presque jamais
  testé, alors que c'est la garde la plus critique.
- **Chemin positif du rôle intermédiaire** : ex. un officier *peut* faire X (souvent
  seuls owner-oui / member-non sont testés).
- **Branches de validation** : valeurs invalides (400), plafonds/conflits (409).
- **Cas limites** : cible déjà dans l'état (409), cible absente (404).
- **Non-authentifié** → 401.

### 5. Restituer, puis agir sur approbation
Rapport court et classé :
- **Verdict autorisation** (sain / faille) + tableau endpoint→garde.
- **Findings sécu** (S1, S2… : sévérité, exploitabilité, ligne).
- **Findings tests** (T1, T2… : scénario manquant, code attendu).
Recommander l'ordre de correction. **Ne rien écrire tant que l'utilisateur n'a pas
choisi.** S'il valide les tests, les écrire dans le `*_test.py` du lot en réutilisant
les helpers `setup*` / `push_*` existants (cf. CLAUDE.md).

## Contraintes
- **Lecture only** pendant l'audit : `Grep` / `Read` ciblés. Ne pas modifier le code
  de prod sans validation explicite d'un finding.
- Toute doc d'audit intermédiaire = **markdown non gité** (préfixe `_audit_…md`),
  jamais committée (convention projet).
- Tests backend : toujours via `mcp__pytest-runner__run_specific_tests` sur le fichier
  du lot, jamais `pytest` brut. Lint final `uvx ruff check`.
- Un changement de code d'autorisation touche la sécurité : proposer de router vers
  l'agent `security-reviewer` avant merge.
- Pour un audit approfondi multi-lots, déléguer l'écriture des tests à `test-python`.
