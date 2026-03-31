# Backup System

Automatic MariaDB backups running inside a dedicated Docker container, with local and encrypted remote (Google Drive via rclone) storage.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  backup container (Alpine)                                  │
│                                                             │
│  crond → backup.sh (every 2h, 08h–22h)                     │
│           │                                                 │
│           ├─ mysqldump → mawster_YYYY-MM-DD_HH-MM.sql.gz   │
│           ├─ local purge  (age > 7j  OR  total > 5 GB)     │
│           └─ rclone → gdrive-crypt:mawster/                 │
│                        remote purge  (age > 7j OR > 3 GB)  │
└─────────────────────────────────────────────────────────────┘
       ↕ depends_on: mariadb (healthy)
       ↕ volume mount: ./backups:/backups
       ↕ bind mount:   ./backup/rclone.conf → /root/.config/rclone/rclone.conf
```

**Schedule:** `0 8,10,12,14,16,18,20,22 * * *` — 8 snapshots/day, every 2 hours between 08:00 and 22:00 (Europe/Paris).

**Retention:**
| Storage | Age limit | Size limit |
|---------|-----------|------------|
| Local (`./backups/`) | 7 days | 5 GB |
| Remote (`gdrive-crypt:mawster/`) | 7 days | 3 GB |

---

## First-time setup

### 1. Configure rclone

On the production server:

```bash
# Install rclone
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

Then copy the generated config to the project:

```bash
cp ~/.config/rclone/rclone.conf ./backup/rclone.conf
```

> `rclone.conf` is gitignored. Never commit it.
> Use `backup/rclone.conf.example` as a reference template.

### 2. Environment variables

`db.env` (already used by `mariadb` service) must expose:

```env
MARIADB_ROOT_PASSWORD=...
MARIADB_DATABASE=mawster
```

These are injected into the `backup` container via `env_file: db.env`.

### 3. Deploy

```bash
make backup-deploy
```

This builds the backup image and starts the container alongside the rest of the prod stack.

---

## Day-to-day operations

### List local backups

```bash
make backup-list
```

### Trigger a manual backup

```bash
make backup-now
```

### View backup logs

```bash
make backup-logs
```

### Restore from a local backup

```bash
make backup-restore FILE=mawster_2026-03-31_08-00.sql.gz
```

### Restore from Google Drive (remote)

```bash
make backup-restore-remote FILE=mawster_2026-03-31_08-00.sql.gz
```

---

## How backup.sh works

1. **Dump** — `mysqldump --single-transaction --routines --triggers | gzip`
2. **Local purge by age** — deletes files older than 7 days
3. **Local purge by size** — deletes oldest files until total < 5 GB
4. **Upload** — `rclone copy` uploads only `mawster_*.sql.gz` files to the encrypted remote
5. **Remote purge by age** — `rclone delete --min-age 7d`
6. **Remote purge by size** — deletes oldest remote files until total < 3 GB

## How restore.sh works

```
restore.sh [--remote] <filename>
```

- Without `--remote`: restores from `./backups/<filename>` (local volume)
- With `--remote`: downloads the file from `gdrive-crypt:mawster/` first, then restores

The restore pipes `gunzip -c | mysql` directly — no temp files.

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| No backups created | `make backup-logs` — check for mysqldump auth errors |
| rclone upload fails | Verify `./backup/rclone.conf` is present and valid; run `rclone listremotes` inside the container |
| Container won't start | `docker compose -f compose-prod.yaml logs backup` |
| mariadb not reachable | Container uses hostname `mariadb` (Docker internal network) — confirm `depends_on` is satisfied |
