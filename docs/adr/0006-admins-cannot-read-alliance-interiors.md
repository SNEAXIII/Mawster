# An Admin has no way into an Alliance

The Admin rank moderates Accounts and handles reported Fight Notes. It grants nothing
inside an Alliance: not its roster, not its Defense Assignment, not its unreported
Fight Notes, not its war history. The only rank that opens an Alliance is a rank of
that Alliance — Owner, Officer, Strategist, member, Visitor — and a reported Fight Note
is the single bridge between the two worlds, opened by a Player choosing to report.

The alternative was the usual one: let Admins read everything so they can support
users and chase cheaters. We refused it because an Alliance's interior is the private
work of a group of players — who they are, how they plan their war — and a support
convenience is a poor reason to make it readable by a rank any future maintainer could
grant themselves.

This is a statement about the product's surface, not about the machine. Whoever runs
the infrastructure can read the database; that is a property of hosting anything, not
a role in this domain, and it is deliberately absent from `CONTEXT.md`. What the ADR
forbids is a Mawster screen, endpoint, or export that hands an Alliance's interior to
an Admin.

## Consequences

Support is limited to what a Player can be asked to reproduce or send: an Admin cannot
open an alliance to diagnose a broken Defense Assignment, and cannot read a Fight Note
to arbitrate a dispute unless someone reports it. Anti-cheat work on war data has no
admin path at all and would need its own decision.

Every future admin screen inherits this: the question "should the admin see this?" is
already answered for anything scoped to an Alliance. Widening it later means revisiting
this ADR, not quietly adding a join.
