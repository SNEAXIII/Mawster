# PostgreSQL before the Rust port

ADR 0009 kept MariaDB until the switch was worth an outage. The Rust port makes it worth one:
the Rust API is written domain by domain against the same database as the Python one, behind
Traefik, so the engine has to be settled first. Switching later would mean porting the queries
twice and taking a second outage. The Python API moves to PostgreSQL 18 now, in one outage, and
the Rust port starts on it.

The Alembic history does not come along. The 45 MariaDB revisions do not replay on PostgreSQL:
`63f2212fe47b` drops foreign keys by their `_ibfk_N` names, `1a0e2a6aa558` runs
`ALTER TABLE … RENAME INDEX`, and 16 files spell `mysql.ENUM`, `mysql.TINYINT` or `mysql.CHAR(32)`.
Rewriting them would produce a history nobody replays. The chain restarts from a single baseline,
`e721cc08693f_postgres_baseline`, generated from the models; the old revisions stay readable in
`api/migrations/mariadb_versions/`, which Alembic does not read. The data moves once, through
`api/scripts/mariadb_to_postgres.py`, into a database already migrated to that baseline.

## Consequences

Every database is initialised with ICU (`--locale-provider=icu --icu-locale=und`), so `ORDER BY`
keeps MariaDB's dictionary order. Comparisons and unique constraints become case- and
accent-sensitive, where `utf8mb4_uca1400_ai_ci` ignored both: code that relied on it, like the
roster import matching champion names, lowercases explicitly.

InnoDB indexed every foreign key implicitly; PostgreSQL does not. A loop in
`api/src/models/__init__.py` indexes every foreign key that leads no existing key, so a new model
gets it without anyone thinking about it.

Staging stays on MariaDB and breaks from the cutover release on: its API, migrate and backup
images expect PostgreSQL. Moving it is a separate piece of work.
