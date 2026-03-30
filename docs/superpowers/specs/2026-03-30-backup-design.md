# Database Backup System — Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Overview

Automated MariaDB backup system running as a dedicated Docker container in the production stack. Backups are compressed with gzip, stored locally on the VPS, and uploaded to personal Google Drive encrypted client-side via rclone crypt (AES-256). Google never sees plaintext data.

---

## Requirements

| Requirement | Value |
|---|---|
| Frequency | Every 2 hours, 8h–22h (Europe/Paris) |
| Schedule (cron) | `0 8,10,12,14,16,18,20,22 * * *` |
| Local max size | 5 GB |
| Remote max size | 3 GB |
| Retention | 7 days (local + remote) |
| Encryption | rclone crypt (AES-256, client-side) |
| Remote storage | Personal Google Drive |

---

## Architecture

```
mariadb ──(réseau internal)──► backup container
                                  ├── crond
                                  ├── backup.sh
                                  │     ├── mysqldump | gzip → /backups/<timestamp>.sql.gz
                                  │     ├── purge locale (>7j puis >5GB)
                                  │     └── rclone copy → gdrive-crypt:mawster/
                                  │           └── purge remote (>7j puis >3GB)
                                  └── restore.sh (usage manuel)
```

---

## Files

```
backup/
├── Dockerfile            # alpine + rclone + mariadb-client + crond
├── backup.sh             # main backup + purge script
├── restore.sh            # manual restore (local or remote)
├── crontab               # cron schedule
└── rclone.conf.example   # template (never committed with real credentials)
```

**Host paths:**
- `./backups/` — local backup storage (bind-mount, visible on host)
- `./backup/rclone.conf` — real rclone config (gitignored, mounted read-only into container)

---

## Dockerfile

Base: `alpine:3.19`
Packages: `mariadb-client`, `rclone`, `gzip`, `bash`, `tzdata`
Entrypoint: `crond -f -l 2` (foreground crond)

---

## backup.sh Logic

1. Run `mysqldump` on all databases via internal Docker network (`mariadb` host)
2. Pipe through gzip → `/backups/mawster_YYYY-MM-DD_HH-MM.sql.gz`
3. **Local purge:**
   - Delete files older than 7 days
   - If total size > 5 GB, delete oldest files until under 5 GB
4. `rclone copy /backups/ gdrive-crypt:mawster/` (uploads new files only)
5. **Remote purge:**
   - Delete remote files older than 7 days via `rclone delete --min-age 7d`
   - If remote total > 3 GB, delete oldest until under 3 GB

Credentials read from env vars (`MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE`) sourced from `db.env`.

---

## restore.sh Logic

Usage:
```bash
# From local backup
restore.sh mawster_2026-03-30_08-00.sql.gz

# From remote (downloads + decrypts automatically via rclone)
restore.sh --remote mawster_2026-03-30_08-00.sql.gz
```

Steps: download from remote if needed → decompress → pipe into `mysql`.

---

## compose-prod.yaml Addition

```yaml
backup:
  build: ./backup
  container_name: backup
  restart: unless-stopped
  networks:
    - internal
  depends_on:
    mariadb:
      condition: service_healthy
  env_file:
    - db.env
  volumes:
    - ./backups:/backups
    - ./backup/rclone.conf:/root/.config/rclone/rclone.conf:ro
  environment:
    - TZ=Europe/Paris
  logging:
    driver: "json-file"
    options:
      max-size: "5m"
      max-file: "3"
```

---

## rclone.conf.example

```ini
[gdrive]
type = drive
client_id = YOUR_CLIENT_ID
client_secret = YOUR_CLIENT_SECRET
token = {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}
scope = drive

[gdrive-crypt]
type = crypt
remote = gdrive:mawster-backups
filename_encryption = standard
directory_name_encryption = true
password = YOUR_RCLONE_CRYPT_PASSWORD
password2 = YOUR_RCLONE_CRYPT_SALT
```

`rclone.conf` is obtained by running `rclone config` interactively on the server once (OAuth flow with Google). The resulting file is placed at `./backup/rclone.conf` on the host and mounted read-only into the container.

---

## .gitignore Additions

```
backup/rclone.conf
backups/
```

---

## Out of Scope

- Email/webhook notifications on backup failure
- Backup of static files (champion images in `/static`)
- Incremental backups (full dump each time is sufficient at this scale)
