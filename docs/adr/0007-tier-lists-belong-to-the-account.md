# Tier lists belong to the Account

Everywhere else in Mawster the game domain hangs off a Player: a roster, an alliance
membership, a war action, the author of a note. A Tier List does not. It hangs off the
Account, and the same list is the same list whichever Player is currently selected.

A Tier List is an opinion about Champions, not a record of play. The person who thinks
Colossus belongs in S thinks it on all ten of their Players — duplicating the list per
Player would ask them to maintain the same opinion several times, and to remember which
copy they last edited.

## Consequences

A Tier List can never be shown inside an Alliance. An Alliance knows Players; it has no
handle on an Account, and reaching one would mean going up from a Player to its Account
and back down to its other Players — exposing the binding that the Account/Player split
exists to keep private. So "the tier lists of my alliance" is not a feature that can be
built on this model, and the sharing story is export and, later, a public link.

Reversing this is a data migration: every list would have to pick one of its Account's
Players, and there is no rule that picks the right one.
