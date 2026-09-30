---
name: merge-pr
description: >
  Merge une PR ouverte sur la branche par défaut une fois la CI verte : liste et trie les PR,
  attend les checks, squash avec un titre conventionnel, supprime la branche et resynchronise.
  Jamais pour promouvoir la branche par défaut vers une branche de release ou de staging.
user-invocable: true
---

# Merge PR

Merge d'une PR ouverte sur la branche par défaut. **Une seule PR par appel.**
`<base>` = `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.

Ouvrir la PR d'une feature : `/make-pr`.

## Sélection de la PR

`/merge-pr <n>` : la PR est donnée, sauter la liste (la confirmation du récapitulatif reste due).

`/merge-pr` nu : lister et **trier**.

```bash
gh pr list --state open --base <base> --json number,title,author,isDraft,mergeable,mergeStateStatus,headRefName,statusCheckRollup
```

Deux tableaux séparés, **humaines** puis **bots** (`author.is_bot`, dependabot, renovate). Aucun
traitement particulier pour les bots : le tri sert juste à ce que le lot de mises à jour ne noie pas
les PR de feature.

Dans chaque tableau, deux blocs :

| Bloc | Critère |
| --- | --- |
| **mergeable direct** | `mergeable == "MERGEABLE"`, pas draft, rollup de checks vert |
| **bloquée** | conflit (`CONFLICTING`), draft, un check rouge, ou des checks en cours |

Afficher numéro, titre, auteur, branche, et pour les bloquées **la raison**. Puis demander laquelle
merger. Ne jamais en choisir une d'office, même s'il n'y en a qu'une.

## Pré-vol — bloquants

Rien n'est corrigé ici. Un bloquant s'expose et arrête le skill.

1. **Base de la PR** — si `baseRefName != <base>` : c'est une promotion, hors de ce skill.
2. **Draft** — s'arrêter, dire qu'il faut la sortir de draft.
3. **Conflit** — `mergeable == "CONFLICTING"` : s'arrêter, dire qu'un rebase sur `<base>` est dû.
4. **Checks**

   ```bash
   gh pr checks <n> --json name,state,link
   ```

   - En cours (`PENDING`) : attendre par pauses de 5 s tant que l'état évolue, **plafond dur
     10 min**. Au-delà, donner l'état courant et s'arrêter.
   - Un `FAILURE` : nommer le check rouge et donner son `link`, puis s'arrêter. **Ne pas
     diagnostiquer.**
   - Un check absent n'est pas un bloquant : les checks conditionnels aux chemins sont normaux.
5. **Worktree local** — `git status --short` sur la branche de la PR, juste avant le merge.
   Un fichier suivi modifié depuis le dernier push : s'arrêter et demander s'il fait partie de la
   PR. L'utilisateur retouche souvent la branche entre le push et le merge.

## Récapitulatif — une seule confirmation

Afficher : numéro, titre, auteur, branche, checks passés, et le **titre du commit de squash**.
Le squash reprend par défaut le titre de la PR ; c'est lui qui finit dans l'historique et le
changelog.

- Titre conventionnel (`feat:`, `fix:`, `chore:`, `ci:`, `refactor:`, `docs:`, `test:`, `build:`,
  `style:`) : le garder tel quel.
- Sinon : proposer un titre corrigé selon les règles de type du `CLAUDE.md` (à défaut, d'après ce
  que voit l'utilisateur final, pas d'après les fichiers touchés), et demander.

C'est le seul endroit où le skill réécrit quelque chose. Une fois confirmé, tout s'enchaîne.

## Déroulé

1. **Squash**, jamais un merge commit — un merge commit reporte le titre de la PR dans son corps,
   qu'un générateur de changelog compte alors une seconde fois :

   ```bash
   gh pr merge <n> --squash --delete-branch --subject "<titre validé>"
   ```

2. **Resynchroniser le local** :

   ```bash
   git checkout <base> && git pull --prune
   ```

   Si le worktree est sale, ne rien forcer : le dire et laisser l'utilisateur ranger.

3. **Si le repo utilise release-please** (`release-please-config.json` présent), rapporter son
   état sans rien lancer :

   ```bash
   gh run list --workflow "Release Please" --branch <base> -L 1 --json status,conclusion,url
   gh pr list --state open --json number,title,url,headRefName \
     --jq '.[] | select(.headRefName | startswith("release-please--"))'
   ```

   Donner la version que porte la PR release-please.

## Règles

- Une seule PR par appel — pas de lot de bots enchaîné.
- Jamais `--admin` : un check rouge n'est pas contournable depuis ici.
- Jamais `--force`, jamais de push direct sur `<base>`.
- Jamais `--merge` ni `--rebase` : squash uniquement.
