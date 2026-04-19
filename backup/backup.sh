#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/backups"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
FILENAME="mawster_${TIMESTAMP}.sql.gz"
MAX_LOCAL_BYTES=$((5 * 1024 * 1024 * 1024))   # 5 GB
MAX_REMOTE_BYTES=$((3 * 1024 * 1024 * 1024))  # 3 GB
RETENTION_DAYS=31
RCLONE_REMOTE="gdrive-crypt:mawster"

# ── 1. Dump ───────────────────────────────────────────────────────────────────
echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Starting dump: $FILENAME"
echo "[backup] Dumping database: ${MARIADB_DATABASE}"
echo "[backup] Local backup directory: ${BACKUP_DIR}"
mysqldump \
  --host=mariadb \
  --user=root \
  --password="${MARIADB_ROOT_PASSWORD}" \
  --databases "${MARIADB_DATABASE}" \
  --single-transaction \
  --routines \
  --triggers \
  --complete-insert \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[backup] Dump complete — size: $SIZE"

# ── 2. Local purge: by age ────────────────────────────────────────────────────
find "${BACKUP_DIR}" -name "mawster_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] Local: purged files older than ${RETENTION_DAYS} days"

# ── 3. Local purge: by size ───────────────────────────────────────────────────
while true; do
  TOTAL=$(du -sb "${BACKUP_DIR}" 2>/dev/null | cut -f1)
  [ "${TOTAL:-0}" -le "$MAX_LOCAL_BYTES" ] && break
  OLDEST=$(ls -t "${BACKUP_DIR}"/mawster_*.sql.gz 2>/dev/null | tail -1)
  [ -z "$OLDEST" ] && break
  echo "[backup] Local over limit ($(( TOTAL / 1024 / 1024 )) MB), deleting: $(basename "$OLDEST")"
  rm "$OLDEST"
done

# ── 4. Upload to remote ───────────────────────────────────────────────────────
echo "[backup] Uploading to remote..."
rclone copy "${BACKUP_DIR}/" "${RCLONE_REMOTE}/" --include "mawster_*.sql.gz"
echo "[backup] Upload complete"

# ── 5. Remote purge: by age ───────────────────────────────────────────────────
rclone delete "${RCLONE_REMOTE}/" --min-age "${RETENTION_DAYS}d" --include "mawster_*.sql.gz"
echo "[backup] Remote: purged files older than ${RETENTION_DAYS} days"

# ── 6. Remote purge: by size ──────────────────────────────────────────────────
REMOTE_SIZE=$(rclone size "${RCLONE_REMOTE}/" --json 2>/dev/null | jq -r '.bytes // 0')
while [ "${REMOTE_SIZE:-0}" -gt "$MAX_REMOTE_BYTES" ]; do
  OLDEST_REMOTE=$(rclone lsf "${RCLONE_REMOTE}/" --format "tp" --separator "|" --files-only 2>/dev/null \
    | sort | head -1 | cut -d'|' -f2)
  [ -z "$OLDEST_REMOTE" ] && break
  echo "[backup] Remote over limit ($(( REMOTE_SIZE / 1024 / 1024 )) MB), deleting: $OLDEST_REMOTE"
  rclone deletefile "${RCLONE_REMOTE}/${OLDEST_REMOTE}"
  REMOTE_SIZE=$(rclone size "${RCLONE_REMOTE}/" --json 2>/dev/null | jq -r '.bytes // 0')
done

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Done: $FILENAME"
