---
name: release-pr
description: >
  Promeut `main` vers `release` (production) ou `staging` et déclenche le déploiement : merge la
  PR release-please, ouvre et merge la PR de promotion, surveille le run jusqu'au déploiement.
  Jamais pour une branche de feature — pour ça, voir `main-pr`.
user-invocable: true
---

# Release PR

Promotion de `main` vers une branche de déploiement. **Ce skill ne sert jamais à ouvrir la PR
d'une feature** : `main` ← feature, c'est `/main-pr`.

## Le pipeline, en une phrase

Un push sur `release` construit les 5 images (`latest` + `X.Y.Z`) et déploie la prod ; un push sur
`staging` construit les images `staging-*` et déploie staging. Aucune CI ne tourne sur la PR de
promotion elle-même (la CI n'écoute que `pull_request: branches: [main]`) : le run part **au
push**, donc après le merge.

Contrainte prod : le job `deploy` échoue si le contenu promu ne correspond pas exactement au
dernier tag `v*` (`released != true`). La PR release-please doit donc être mergée avant.

## Mode

`prod` (branche `release`) ou `staging` (branche `staging`).

- Argument donné (`/release-pr prod`, `/release-pr staging`) : il fait foi, ne rien demander.
- `/release-pr` nu : demander le mode avant tout autre chose.

## Pré-vol

Toujours `git fetch origin --tags --prune` d'abord.

### Bloquants — prod

1. **Run Release Please**

   ```bash
   gh run list --workflow "Release Please" --branch main -L 1 --json status,conclusion,url
   ```

   - `in_progress` / `queued` : attendre par pauses de 5 s tant que le statut évolue, **plafond
     dur 10 min**. Au-delà, prévenir (run coincé : queue ou token) et s'arrêter.
   - `conclusion` ≠ `success` : s'arrêter en donnant l'URL du run. Un release-please rouge veut
     dire tag ou CHANGELOG manquants — c'est la cause racine d'un contenu non taggé.

2. **Contenu taggé**

   ```bash
   gh pr list --state open --json number,title,url,headRefName \
     --jq '.[] | select(.headRefName | startswith("release-please--"))'
   git log --oneline "$(git describe --tags --abbrev=0 --match 'v*' origin/main)"..origin/main
   ```

   - PR release-please ouverte : elle sera squashée (voir Déroulé).
   - Aucune PR ouverte **et** des commits après le dernier tag : s'arrêter — release-please n'a
     rien produit pour ces commits.
   - Aucune PR ouverte et rien après le tag : cas nominal du rattrapage. Le dire (« rien à
     publier, promotion de vX.Y.Z déjà taggée ») et continuer.

3. **Heads Alembic** (prod et staging)

   ```bash
   cd api/migrations/versions && comm -23 \
     <(grep -h '^revision: str = ' *.py | cut -d'"' -f2 | sort) \
     <(grep -h '^down_revision' *.py | cut -d'"' -f2 | sort)
   ```

   Plus d'une ligne = deux heads : s'arrêter. Ça passe la CI et casse le job `migrate` en prod.

### Avertissements — prévenir, demander, ne rien faire d'autre

4. **Dernier commit de `main` non vert**

   ```bash
   gh api repos/SNEAXIII/Mawster/commits/main/check-runs \
     --jq '.check_runs[] | select(.conclusion != "success" and .conclusion != null) | .name'
   ```

5. **`release` a des commits absents de `main`** (prod uniquement)

   ```bash
   git rev-list --count origin/main..origin/release
   ```

   Normal : ce sont les merge commits des promotions précédentes.

Sur un avertissement : l'exposer, demander s'il faut continuer, et **ne rien corriger**.

### Staging

Seul le contrôle **3** est bloquant, le **4** reste un avertissement. Les contrôles 1, 2 et 5 ne
s'appliquent pas : staging n'exige aucun tag — c'est là qu'on teste avant de tagger.

## Récapitulatif — une seule confirmation

Avant d'agir, afficher : le mode, la branche cible, la version promue, les contrôles passés, et
ce qui va être mergé (PR release-please + PR de promotion). Une fois confirmé, tout s'enchaîne
sans redemander.

## Déroulé — prod

1. **Squash de la PR release-please**, si elle existe :

   ```bash
   gh pr merge <n> --squash
   ```

   Le titre (`chore(main): release 1.8.3`) donne la version cible.

2. **PR de promotion**, immédiatement — sans attendre l'apparition du tag :

   ```bash
   git log --oneline origin/release..origin/main --grep '^chore(main): release'   # versions incluses
   gh pr create --base release --head main --title "release: v1.8.0 → v1.8.2" --body "$BODY"
   ```

   - Titre : `release: vX.Y.Z` pour une seule version, `release: vA → vB` quand plusieurs
     versions partent d'un coup.
   - Corps : uniquement la liste des versions incluses (`- v1.8.1`), une par ligne. Pas de
     CHANGELOG recopié — il diverge.

3. **Merge en merge commit**, jamais en squash :

   ```bash
   gh pr merge <n> --merge
   ```

   Le job `changes` compare les *arbres* (`git diff --quiet "$LAST_TAG" HEAD`) précisément parce
   que la promotion produit un merge commit.

## Déroulé — staging

Identique, sans l'étape 1 :

```bash
gh pr create --base staging --head main --title "staging: $(git describe --tags --match 'v*' origin/main)"
gh pr merge <n> --merge
```

Le titre reprend `git describe` tel quel (`staging: v1.8.2-3-gabc123`) : c'est exactement le tag
des images poussées (`staging-1.8.2-3-gabc123`), donc retrouvable sur Docker Hub.

## Surveillance

Le run part au push sur la branche cible. ~15-20 min (E2E sur 8 runners + 5 images + swarm) —
le lancer **en tâche de fond**.

```bash
gh run list --branch release -L 1 --json databaseId --jq '.[0].databaseId'
gh run watch <id> --exit-status
```

Rapporter la conclusion du job `deploy` (ou `deploy-staging`) et l'URL du run. En cas d'échec :
nommer le job rouge et donner l'URL. **Ne pas diagnostiquer ni corriger** — la release s'arrête là.

## Règles

- Jamais de push direct sur `release` ou `staging` : toujours par PR.
- Jamais de `--force`.
- Jamais de squash sur la PR de promotion.
- Une PR de feature ne passe pas par ici : `/main-pr`.
