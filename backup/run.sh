BACKUP_CRON_ENABLED=${BACKUP_CRON_ENABLED:-true}

# When the cron is disabled (e.g. staging), keep the container alive so backups
# and restores can still be triggered manually via `docker exec`.
if [ "$BACKUP_CRON_ENABLED" != "true" ]; then
    echo "[run] cron disabled (BACKUP_CRON_ENABLED=$BACKUP_CRON_ENABLED) — idle, manual backups only"
    exec tail -f /dev/null
fi

BACKUP_INTERVAL=${BACKUP_INTERVAL:-3600}

while true; do
    /usr/local/bin/backup.sh || echo "[run] backup failed, retrying in ${BACKUP_INTERVAL}s" >&2
    sleep "$BACKUP_INTERVAL"
done