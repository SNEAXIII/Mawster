# Fight Records copy champion stats instead of joining them

A Fight Record stores the attacker's and defender's stars, rank and ascension inline,
along with the War's Tier, rather than joining back to the Roster Entry and Champion
rows. A Roster Entry is mutable — a Player ranks a champion up — and joining would let
that rewrite fights that already happened.

## Consequences

The denormalisation is deliberate: do not "normalise" it back. It is also what makes
Fight Records comparable at all, since node difficulty scales with Tier and a fight is
only meaningful against fights at the same Tier.

Fight Records are frozen history, not an evidence base: the Matchup Builder is
experimental and deliberately decoupled from them.
