# Fight Records freeze only what the attacker can still change

A Fight Record points at the War Defense Placement it was fought on and copies two
values: the attacker's rank and ascension at the time. Everything else — Tier, node,
KOs, boosts, the defender, the attacker's stars and account — is read through the
placement, its War and the attacker's Roster Entry.

Rank and ascension are the stats a Player still changes on a Roster Entry after the
fight; joining them would let an upgrade rewrite history. The rest used to be copied
too, which meant correcting a fight after the war twice: on the placement and on the
record. Signature is not frozen: it does not change how a fight reads.

## Consequences

The joins hold because no foreign key on the path cascades: a Roster Entry or a
placement a record points at cannot be deleted from under it. Saga roles are read from
the Season at query time, so an admin correction reaches past fights. Synergies and
prefights are read live from the war.

A record whose placement lost its attacker, or was marked as not fought, drops out of
every read without being deleted. Fights stay comparable only at equal Tier, now read
from the War.

Fight Records are frozen history, not an evidence base: the Matchup Builder is
experimental and deliberately decoupled from them.
