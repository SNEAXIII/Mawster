#!/usr/bin/env bash
# Tags the 24 versions reconstructed in CHANGELOG.md.
#
# Each version is anchored on the commit of main that the deploy actually promoted: the
# main-side parent of the last "Merge pull request from SNEAXIII/main" landing on release on
# that date. Anchoring on the last commit of main that day is wrong - the deploy often runs
# late in the evening, and commits pushed afterwards ship with the *next* deploy.
#
# The three versions predating the first production deploy (2026-04-30) have no such merge to
# anchor on, and fall back to the last commit of main on their date.
#
# Tags are annotated and never overwrite an existing tag.
#
#   ./scripts/backfill_version_tags.sh          # show what would be tagged
#   ./scripts/backfill_version_tags.sh --apply  # create the tags locally
#
# Publishing stays manual and deliberate: git push origin --tags

set -euo pipefail

# Day boundaries are read in the author's timezone, not the runner's. A deploy at 01:33 Paris
# time belongs to the previous day in UTC, which would pull the next day's work into the tag.
export TZ=Europe/Paris

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

# version|date|title
VERSIONS=(
  "0.1.0|2026-02-14|Première version de Mawster"
  "0.2.0|2026-03-31|Guerre d'alliance, sauvegardes, suite E2E"
  "0.3.0|2026-04-19|Synergies, bans, prefight, saisons, maîtrises"
  "0.4.0|2026-04-30|Première mise en production"
  "0.5.0|2026-05-02|Stabilisation après la mise en production"
  "0.6.0|2026-05-08|Base de connaissances"
  "0.7.0|2026-05-13|Usage des champions, visiteurs d'alliance"
  "0.8.0|2026-05-16|Historique d'ELO, participation aux guerres"
  "0.9.0|2026-05-19|Assistance de guerre"
  "0.10.0|2026-05-22|Filtre par saison, validation des noms"
  "0.11.0|2026-05-26|Exports PNG, 7r6, transfert de propriété"
  "0.12.0|2026-06-04|Import CSV des relevés de combat"
  "0.13.0|2026-06-26|Notes de combat et modération"
  "0.14.0|2026-06-29|Page d'accueil publique"
  "0.15.0|2026-07-02|Filtres de roster, lien de partage"
  "0.16.0|2026-07-06|Recherche de champion d'alliance, sagas par saison"
  "0.17.0|2026-07-08|Statistiques de joueur sur le profil"
  "0.18.0|2026-07-13|Matchups"
  "1.0.0|2026-07-23|Import du roster par capture d'écran"
  "1.1.0|2026-07-29|Aide à l'import, vignettes regroupées"
  "1.2.0|2026-08-03|Envoi direct des captures, validation par écran"
  "1.3.0|2026-08-14|Rattachement d'une connexion à un compte existant"
  "1.4.0|2026-08-24|Rafraîchissement des champions, exports haute résolution"
  "1.5.0|2026-08-25|Suppression de compte et d'alliance"
)

for entry in "${VERSIONS[@]}"; do
  IFS='|' read -r version date title <<<"$entry"
  tag="v${version}"

  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "= ${tag} already exists, skipped"
    continue
  fi

  # Last deploy of the wave: a merge of main into release, dated on or before that day.
  deploy=$(git log --first-parent --format='%H %s' --until="${date} 23:59:59" origin/release \
             | grep -m1 'from SNEAXIII/main' | cut -d' ' -f1 || true)

  if [ -n "$deploy" ]; then
    commit=$(git rev-parse "${deploy}^2")
    origin="deploy ${deploy:0:8}"
  else
    # Before the first production deploy, nothing was promoted; fall back to main.
    commit=$(git rev-list -1 --first-parent --until="${date} 23:59:59" origin/main)
    origin="main (pre-production)"
  fi

  if [ -z "$commit" ]; then
    echo "! ${tag}: no commit found for ${date}" >&2
    exit 1
  fi

  if $APPLY; then
    GIT_COMMITTER_DATE="${date}T12:00:00" \
      git tag -a "$tag" "$commit" -m "${version} — ${title}"
    echo "+ ${tag} → ${commit:0:8}  ${date}  ${origin}"
  else
    echo "  ${tag} → ${commit:0:8}  ${date}  ${origin}  — ${title}"
  fi
done

if ! $APPLY; then
  echo
  echo "Preview only. Re-run with --apply to create the tags."
else
  echo
  echo "Tags created locally. To publish them: git push origin --tags"
fi
