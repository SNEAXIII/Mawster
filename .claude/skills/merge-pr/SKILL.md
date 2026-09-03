---
name: merge-pr
description: >
  Merge une PR ouverte sur `main` une fois la CI verte : liste et trie les PR, attend les checks,
  squash avec un titre conventionnel, supprime la branche et resynchronise `main`.
  Jamais pour promouvoir `main` vers `release` ou `staging` — pour déployer, voir `release-pr`.
user-invocable: true
---

# Merge PR

Merge d'une PR ouverte sur `main`. **Une seule PR par appel.**

- Ouvrir la PR d'une feature : `/main-pr`.
- Promouvoir `main` vers `release` / `staging` : `/release-pr`.

## Les checks, en une phrase

La CI (`CI Pipeline`) ne tourne que sur `pull_request: branches: [main]` : sur une PR de feature
on attend *Lint & Test for backend*, *Lint & typecheck for frontend*, les E2E (8 runners), `Sonar`
et `Security Scan`. `Vision gate` est **conditionnel** aux chemins `static-assets/static/champions/**`
et `api/src/fixtures/champions.json` — son absence est normale, ne jamais l'exiger.

## Sélection de la PR

`/merge-pr <n>` : la PR est donnée, sauter la liste (la confirmation du récapitulatif reste due).

`/merge-pr` nu : lister et **trier**.

```bash
gh pr list --state open --base main --json number,title,author,isDraft,mergeable,mergeStateStatus,headRefName,statusCheckRollup
```

Deux tableaux séparés, **humaines** puis **dependabot** (`author.login == "app/dependabot"` ou
`author.is_bot`). Aucun traitement particulier pour dependabot : le tri sert juste à ce que le lot
de mises à jour ne noie pas les PR de feature.

Dans chaque tableau, deux blocs :

| Bloc | Critère |
| --- | --- |
| **mergeable direct** | `mergeable == "MERGEABLE"`, pas draft, rollup de checks vert |
| **bloquée** | conflit (`CONFLICTING`), draft, un check rouge, ou des checks en cours |

Afficher numéro, titre, auteur, branche, et pour les bloquées **la raison**. Puis demander laquelle
merger. Ne jamais en choisir une d'office, même s'il n'y en a qu'une.

## Pré-vol — bloquants

Rien n'est corrigé ici. Un bloquant s'expose et arrête le skill.

1. **Base de la PR** — si `baseRefName != main` : c'est une promotion, renvoyer vers `/release-pr`.
2. **Draft** — s'arrêter, dire qu'il faut la sortir de draft.
3. **Conflit** — `mergeable == "CONFLICTING"` : s'arrêter, dire qu'un rebase sur `main` est dû.
4. **Checks**

   ```bash
   gh pr checks <n> --json name,state,link
   ```

   - En cours (`PENDING`) : attendre par pauses de 5 s tant que l'état évolue, **plafond dur
     10 min**. Au-delà, donner l'état courant et s'arrêter.
   - Un `FAILURE` : nommer le check rouge et donner son `link`, puis s'arrêter. **Ne pas
     diagnostiquer.** Ça vaut aussi pour le gate `Sonar` : on rapporte le verdict, pas le détail
     des conditions (voir Dette connue).

## Récapitulatif — une seule confirmation

Afficher : numéro, titre, auteur, branche, checks passés, et le **titre du commit de squash**.

Ce titre compte : release-please le lit pour décider du bump et écrire le `CHANGELOG`. Le squash
reprend par défaut le titre de la PR.

- Titre conventionnel (`feat:`, `fix:`, `chore:`, `ci:`, `refactor:`, `docs:`, `test:`, `build:`,
  `style:`) : le garder tel quel.
- Sinon : proposer un titre corrigé, en choisissant le type d'après **ce qu'un joueur voit**, pas
  d'après les fichiers touchés (voir la section « Commit types » de `CLAUDE.md`), et demander.

C'est le seul endroit où le skill réécrit quelque chose. Une fois confirmé, tout s'enchaîne.

## Déroulé

1. **Squash**, jamais un merge commit — un merge commit fait recompter le titre de la PR par
   release-please, qui duplique alors chaque entrée du CHANGELOG :

   ```bash
   gh pr merge <n> --squash --delete-branch --subject "<titre validé>"
   ```

2. **Resynchroniser le local** :

   ```bash
   git checkout main && git pull --prune
   ```

   Si le worktree est sale, ne rien forcer : le dire et laisser l'utilisateur ranger.

3. **État de release-please**, puis proposer la suite sans la lancer :

   ```bash
   gh run list --workflow "Release Please" --branch main -L 1 --json status,conclusion,url
   gh pr list --state open --json number,title,url,headRefName \
     --jq '.[] | select(.headRefName | startswith("release-please--"))'
   ```

   Rapporter la version que la PR release-please porte, et proposer `/release-pr prod` — sans
   l'exécuter.

## Dette connue

Le détail du gate Sonar n'est pas exploité : quand `Sonar` est rouge, le skill donne l'URL et
s'arrête, sans dire quelle condition casse (couverture du nouveau code, duplication, issues
bloquantes). Le serveur MCP `sonarqube` le permettrait — `get_project_quality_gate_status` puis
`search_sonar_issues_in_projects` sur `projectKey=SNEAXIII_Mawster` avec le numéro de PR. Écarté
pour l'instant, noté dans `docs/backlog.md`.

## Règles

- Une seule PR par appel — pas de lot dependabot enchaîné.
- Jamais `--admin` : un check rouge n'est pas contournable depuis ici.
- Jamais `--force`, jamais de push direct sur `main`.
- Jamais `--merge` ni `--rebase` : squash uniquement.
- Une promotion `main → release` ou `main → staging` ne passe pas par ce skill.
