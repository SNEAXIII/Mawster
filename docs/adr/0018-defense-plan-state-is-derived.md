# A Defense Plan's state is derived, never stored

Pending and Validated are computed from a plan's nodes on every read: every Champion has a
Player, no Player exceeds the format's defender cap, and the map is as full as the
Battlegroup allows. No `status` column holds them. A stored state would have to be kept in
step by every path that touches a node — a placement, a removal, a member leaving or
changing Battlegroup, a Champion deleted from a roster — and any path that forgets leaves a
plan claiming Validated with a hole in it.

Active is the one exception, stored, because it is a choice a Strategist makes rather than
a fact about the nodes. It is only granted to a Validated plan, and it survives the plan
falling back to Pending: the game still carries that layout, so the plan stays active and is
flagged incomplete instead of silently switching off.

## Consequences

Reading a plan's state costs a pass over its nodes and the Battlegroup's defender counts;
listing ten plans does it ten times. Cheap at 50 nodes, and cacheable if it ever is not.

The migration that splits today's single layout into one regular and one big_thing plan per
Battlegroup marks both active whatever their state. The big_thing copy keeps its Players as
they were, so it usually starts over the cap and shows as incomplete until fixed by hand.
