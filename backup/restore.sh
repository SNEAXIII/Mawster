#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/backups"
RCLONE_REMOTE="gdrive-crypt:mawster"

# Fall back to the mounted secret when the caller didn't pass the password in.
MARIADB_ROOT_PASSWORD=${MARIADB_ROOT_PASSWORD:-$(cat /run/secrets/mawster_db_root_password 2>/dev/null || true)}

REMOTE=false
FILENAME=""

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      REMOTE=true
      shift
      ;;
    *)
      FILENAME="$1"
      shift
      ;;
  esac
done

if [[ -z "$FILENAME" ]]; then
  echo "Usage: restore.sh [--remote] <filename>" >&2
  echo "Example: restore.sh mawster_2026-03-30_08-00.sql.gz" >&2
  echo "Example: restore.sh --remote mawster_2026-03-30_08-00.sql.gz" >&2
  exit 1
fi

# ── Download from remote if needed ───────────────────────────────────────────
if [[ "$REMOTE" = true ]]; then
  echo "[restore] Downloading $FILENAME from remote..."
  rclone copy "${RCLONE_REMOTE}/${FILENAME}" "${BACKUP_DIR}/"
  echo "[restore] Download complete"
fi

FILEPATH="${BACKUP_DIR}/${FILENAME}"

if [[ ! -f "$FILEPATH" ]]; then
  echo "[restore] ERROR: File not found: $FILEPATH" >&2
  echo "[restore] Available local backups:" >&2
  ls -lh "${BACKUP_DIR}"/mawster_*.sql.gz >&2 2>/dev/null || echo "  (none)" >&2
  exit 1
fi

# ── Restore ───────────────────────────────────────────────────────────────────
echo "[restore] Restoring from $FILENAME..."
gunzip -c "$FILEPATH" | mysql \
  --host=mariadb \
  --user=root \
  --password="${MARIADB_ROOT_PASSWORD}"

echo "[restore] Done."
