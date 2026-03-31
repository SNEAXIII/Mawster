#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/backups"
RCLONE_REMOTE="gdrive-crypt:mawster"

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

if [ -z "$FILENAME" ]; then
  echo "Usage: restore.sh [--remote] <filename>"
  echo "Example: restore.sh mawster_2026-03-30_08-00.sql.gz"
  echo "Example: restore.sh --remote mawster_2026-03-30_08-00.sql.gz"
  exit 1
fi

# ── Download from remote if needed ───────────────────────────────────────────
if [ "$REMOTE" = true ]; then
  echo "[restore] Downloading $FILENAME from remote..."
  rclone copy "${RCLONE_REMOTE}/${FILENAME}" "${BACKUP_DIR}/"
  echo "[restore] Download complete"
fi

FILEPATH="${BACKUP_DIR}/${FILENAME}"

if [ ! -f "$FILEPATH" ]; then
  echo "[restore] ERROR: File not found: $FILEPATH"
  echo "[restore] Available local backups:"
  ls -lh "${BACKUP_DIR}"/mawster_*.sql.gz 2>/dev/null || echo "  (none)"
  exit 1
fi

# ── Restore ───────────────────────────────────────────────────────────────────
echo "[restore] Restoring from $FILENAME..."
gunzip -c "$FILEPATH" | mysql \
  --host=mariadb \
  --user=root \
  --password="${MARIADB_ROOT_PASSWORD}"

echo "[restore] Done."
