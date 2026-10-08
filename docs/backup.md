# Backup System

The `backup` service of `stack-app.yaml` dumps MariaDB, keeps the dumps locally and uploads them
to an encrypted Google Drive remote through rclone.

## Schedule & retention

`run.sh` loops: `backup.sh`, then `sleep $BACKUP_INTERVAL` (7200 s in prod). With
`BACKUP_CRON_ENABLED=false` (staging) the container idles and only manual backups run.

| Storage | Age limit | Size limit |
|---------|-----------|------------|
| Local (`/home/mawster/Mawster/backups` → `/backups`) | 7 days | 5 GB |
| Remote (`gdrive-crypt:mawster/`) | 7 days | 3 GB |

## First-time setup

```bash
curl https://rclone.org/install.sh | sudo bash
# Interactive config — creates two remotes:
#   gdrive       → Google Drive (OAuth2)
#   gdrive-crypt → crypt layer on top of gdrive
rclone config
```

When creating the `gdrive-crypt` remote:
- **Remote:** `gdrive:mawster-backups`
- **filename_encryption:** `standard`
- **directory_name_encryption:** `true`
- Set a strong **password** and **salt** — save them safely, loss = permanent data loss.

Then hand the config to Swarm (see [`secrets.md`](secrets.md)); `backup/rclone.conf.example` is
the reference template:

```bash
docker secret create mawster_rclone_conf ~/.config/rclone/rclone.conf
```

## Day-to-day operations

```bash
make backup-list
make backup-now
make backup-restore FILE=mawster_2026-03-31_08-00.sql.gz
make backup-restore-remote FILE=mawster_2026-03-31_08-00.sql.gz   # downloads from gdrive-crypt first
docker service logs -f mawster_backup
```

`backup-list`, `backup-now` and `backup-restore` have a `-staging` twin.

## How backup.sh works

1. **Dump** — `mysqldump --single-transaction --routines --triggers | gzip`
2. **Local purge** — by age, then oldest first until under 5 GB
3. **Upload** — `rclone copy` of `mawster_*.sql.gz` to the encrypted remote
4. **Remote purge** — `rclone delete --min-age 7d`, then oldest first until under 3 GB

## Troubleshooting

| Issue | Check |
|-------|-------|
| No backups created | `docker service logs mawster_backup` — look for dump auth errors |
| rclone upload fails | `docker secret inspect mawster_rclone_conf`; run `rclone listremotes` inside the container |
| Container won't start | `docker service ps mawster_backup --no-trunc` |
