#!/usr/bin/env bash
set -euo pipefail

trap 'echo "[backup] FATAL: backup failed at line $LINENO (exit $?)" >&2; exit 1' ERR

# ── Secrets ──────────────────────────────────────────────────────────────────
export MARIADB_ROOT_PASSWORD=$(cat /run/secrets/mawster_db_root_password)

# Remote upload (Google Drive via rclone) is optional — disabled on staging.
BACKUP_REMOTE_ENABLED=${BACKUP_REMOTE_ENABLED:-true}
if [ "$BACKUP_REMOTE_ENABLED" = "true" ]; then
  RCLONE_CONFIG_WRITABLE=/tmp/rclone.conf
  cp /run/secrets/mawster_rclone_conf "$RCLONE_CONFIG_WRITABLE"
  chmod 600 "$RCLONE_CONFIG_WRITABLE"
  export RCLONE_CONFIG="$RCLONE_CONFIG_WRITABLE"
fi

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/backups"
# Distinguishes environments in filenames (e.g. mawster / mawster-staging). Prod default keeps legacy names.
BACKUP_PREFIX=${BACKUP_PREFIX:-mawster}
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
FILENAME="${BACKUP_PREFIX}_${TIMESTAMP}.sql.gz"
MAX_LOCAL_BYTES=$((5 * 1024 * 1024 * 1024))   # 5 GB
MAX_REMOTE_BYTES=$((3 * 1024 * 1024 * 1024))  # 3 GB
RETENTION_DAYS=14
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
find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] Local: purged files older than ${RETENTION_DAYS} days"

# ── 3. Local purge: by size ───────────────────────────────────────────────────
while true; do
  TOTAL=$(du -sb "${BACKUP_DIR}" 2>/dev/null | cut -f1)
  [ "${TOTAL:-0}" -le "$MAX_LOCAL_BYTES" ] && break
  OLDEST=$(ls -t "${BACKUP_DIR}"/${BACKUP_PREFIX}_*.sql.gz 2>/dev/null | tail -1)
  [ -z "$OLDEST" ] && break
  echo "[backup] Local over limit ($(( TOTAL / 1024 / 1024 )) MB), deleting: $(basename "$OLDEST")"
  rm "$OLDEST"
done

if [ "$BACKUP_REMOTE_ENABLED" = "true" ]; then
  # ── 4. Upload to remote ─────────────────────────────────────────────────────
  echo "[backup] Uploading to remote..."
  rclone copy "${BACKUP_DIR}/" "${RCLONE_REMOTE}/" --include "${BACKUP_PREFIX}_*.sql.gz"
  echo "[backup] Upload complete"

  # ── 5. Remote purge: by age ─────────────────────────────────────────────────
  rclone delete "${RCLONE_REMOTE}/" --min-age "${RETENTION_DAYS}d" --include "${BACKUP_PREFIX}_*.sql.gz" --drive-use-trash=false
  echo "[backup] Remote: purged files older than ${RETENTION_DAYS} days"

  # ── 6. Remote purge: by size ────────────────────────────────────────────────
  REMOTE_SIZE=$(rclone size "${RCLONE_REMOTE}/" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2)
  while [ "${REMOTE_SIZE:-0}" -gt "$MAX_REMOTE_BYTES" ]; do
    OLDEST_REMOTE=$(rclone lsf "${RCLONE_REMOTE}/" --format "tp" --separator "|" --files-only 2>/dev/null \
      | sort | head -1 | cut -d'|' -f2)
    [ -z "$OLDEST_REMOTE" ] && break
    echo "[backup] Remote over limit ($(( REMOTE_SIZE / 1024 / 1024 )) MB), deleting: $OLDEST_REMOTE"
    rclone deletefile "${RCLONE_REMOTE}/${OLDEST_REMOTE}" --drive-use-trash=false
    REMOTE_SIZE=$(rclone size "${RCLONE_REMOTE}/" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2)
  done
else
  echo "[backup] Remote upload disabled (BACKUP_REMOTE_ENABLED=false) — local backup only"
fi

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Done: $FILENAME"
