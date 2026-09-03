# Structured data goes in tables, never in a JSON column

MariaDB accepts JSON columns and Pydantic serialises into them without complaint, so the
shortcut is always available: a list of nodes, a set of options, a bag of per-champion
attributes, all fit in one column and cost no migration. We model them relationally instead —
a table, its foreign keys, and an explicit position column wherever order carries meaning.

The trade is deliberate. A JSON column buys schema flexibility, which is worth most when the
shape is genuinely unknown or belongs to an external system. Nothing here is in that position:
every structure we store is one we designed and will query. What we buy back is the ability to
filter, join and aggregate on those fields, constraints the database actually enforces, and
migrations that can rewrite the data — none of which a JSON blob gives without parsing every
row in application code.

Order is the part that gets forgotten. A JSON array carries its ordering for free; a table does
not. Any collection whose sequence is meaningful gets a position column from the outset, because
adding one later means backfilling rows whose original order is gone.

## Consequences

More tables, more foreign keys, more migrations: a feature that would have been one column is
several files. Each new list-shaped concept costs an Alembic revision rather than a schema-free
write.

The rule is not enforced by anything. Nothing in the linters, in Sonar, or in the model layer
rejects a `JSON` column — SQLModel will map one happily. It holds by review only, which is why it
is written here rather than assumed.

The payoff compounds with the engine question (ADR 0009): because the data is relational rather
than blob-shaped, a future move to another database is a matter of dialects and migration
syntax, not of re-parsing every stored document.
