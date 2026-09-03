# Alliance ranks are one table per rank, not a rank column

Adding the Strategist — placement rights over an Alliance with no authority over its
people — could have folded Officer and Strategist into one `alliance_role` table with a
rank enum. We kept a dedicated `alliance_strategist` table mirroring `alliance_officer`
instead, because nothing guarantees the ranks stay mutually exclusive: with a rank
column, "this Player is both X and Y" becomes a schema migration, while with a table per
rank it is an insert.

## Consequences

The ranks are exclusive today, but that exclusivity lives in service code, not in the
schema — nothing at the database level stops a Player from holding an Officer row and a
Strategist row at once, so every promotion path must delete the row it supersedes. Guards
spell the ladder out rather than comparing a rank: `require_officer` accepts the Owner,
`can_place` accepts Officer and Strategist. Each new rank costs a table and a migration.
