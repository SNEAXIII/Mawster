# Fight Records freeze the attacker stats an upgrade could rewrite

A Fight Record points at the War Node it was fought on and copies only the Attacker's
rank and ascension. Those are the two values a Player changes on a Roster Entry after the
fact — ranking a champion up — and joining them live would rewrite fights that already
happened. Everything else is read through the War Node and its War: the enemy defender
is what an Officer recorded there, and the Tier is stamped on the War when it closes.
Neither belongs to a mutable Roster Entry, so copying them bought nothing.

## Consequences

The copy of rank and ascension is deliberate: do not "normalise" it back. It is also what
makes Fight Records comparable at all, since node difficulty scales with Tier and a fight
is only meaningful against fights at the same Tier.

A correction of a closed War's Attacker re-freezes these two values, see
`0017-a-closed-wars-map-stays-correctable.md`.

Fight Records are frozen history, not an evidence base: the Matchup Builder is
experimental and deliberately decoupled from them.
