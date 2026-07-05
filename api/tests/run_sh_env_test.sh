#!/usr/bin/env sh
# Vérifie le pattern env-first "${VAR:-$(cat file)}" utilisé par api/run.sh et front/run.sh.
set -e
tmp="$(mktemp -d)"
echo "from-file" > "$tmp/secret"

# Cas 1 : env défini -> la valeur env gagne, le fichier est ignoré.
VAL="$(SECRET_KEY=from-env sh -c 'echo "${SECRET_KEY:-$(cat '"$tmp"'/secret)}"')"
[ "$VAL" = "from-env" ] || { echo "FAIL cas1: got '$VAL'"; exit 1; }

# Cas 2 : env absent -> fallback vers le fichier.
VAL="$(sh -c 'echo "${SECRET_KEY:-$(cat '"$tmp"'/secret)}"')"
[ "$VAL" = "from-file" ] || { echo "FAIL cas2: got '$VAL'"; exit 1; }

rm -rf "$tmp"
echo "OK run.sh env-first pattern"
