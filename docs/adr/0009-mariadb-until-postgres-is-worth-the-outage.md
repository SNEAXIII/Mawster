# MariaDB stays until Postgres is worth an outage

MariaDB was never chosen over Postgres; it was what the project started on, and no moment since
has been convenient enough to change it. That is an honest description of the state: the
preference now runs the other way. Postgres handles memory and connections better under
pressure, which matters on a single 8 GB / 2 vCPU host running the whole stack, and nothing
MariaDB offers pulls in the opposite direction.

What holds the migration back is the cost of the switch, not the merits of the engine. Mawster
is in production. Moving means taking it down, dumping and restoring, rebuilding the backup
chain that currently produces gzipped MySQL dumps, and — the part nobody can estimate from a
distance — confirming that 25 Alembic revisions written against MariaDB replay on Postgres.
That last one is not a formality: MariaDB and Postgres disagree on constraint naming, and this
project has already been bitten by it once, when a MariaDB version bump renamed foreign keys
from `_ibfk_N` to bare ordinals.

So this is not technical debt in the usual sense — nothing in the code is wrong, and the schema
is relational rather than engine-specific precisely because ADR 0008 keeps it that way. It is a
deferred piece of work whose cost has never been measured.

## Consequences

MariaDB is pinned to `11.4` in `compose-dev.yaml` and `stack-app.yaml` rather than tracking
`latest`, after a newer release combined with a Windows bind mount corrupted InnoDB on the
second rebuild. The pin is load-bearing; moving it needs a reason and a test.

The decision to migrate cannot be taken on its merits until someone replays the migration chain
against a throwaway Postgres and counts what breaks. Until that number exists, "we should move
to Postgres" stays an opinion. The measurement is cheap and touches nothing in production — it
is recorded in `docs/backlog.md`, not scheduled.

Every day this waits, the chain gets one revision longer and the production dataset larger, so
the cost of the eventual move only rises.
