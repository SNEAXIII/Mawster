# A vision Reading is not a fact

The vision pipeline speaks its own language until a Player accepts its output.
`VisionPrediction` stores the champion name as free text rather than a `Champion`
foreign key, and `VisionSample` carries `import_id` and `game_account_id` with no
foreign keys at all. A Reading is a guess: it may name a champion that is absent from
the catalog, and the worker routinely runs ahead of the database, so a foreign key
would turn a desync into a hard failure on data that is not yet domain data.

A Reading enters the domain at one point only: when the Player accepts it and it becomes
a Roster Entry.

## Consequences

Dataset Samples live in their own object store (RustFS) and outlive the Import they came
from. They still record which Player sent the screenshot — not to exploit the identity,
but so a Player who withdraws consent can have their samples removed. Dropping that
column would make consent withdrawal impossible to honour.

Reversing this means backfilling and validating free text against the catalog for data
already written, on both the database and the object store.
