BACKUP_INTERVAL=${BACKUP_INTERVAL:-3600}

while true; do
    /usr/local/bin/backup.sh || echo "[run] backup failed, retrying in ${BACKUP_INTERVAL}s" >&2
    sleep "$BACKUP_INTERVAL"
done