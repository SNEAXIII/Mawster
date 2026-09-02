# The Opponent is a label, not an entity

`War.opponent_name` is free text with no foreign key and no Alliance row. Enemy
alliances are not Mawster users: we cannot verify who they are, only record what one of
our Players typed. Modelling them as entities would mean inventing identity for data we
do not own.

## Consequences

Two Wars against the same enemy are deliberately unlinked, and a typo forks the history.
Any future "we fought them before, here is their last defense" feature needs a
deduplication rule for typed names before it can exist — that is the real cost of this
decision, and it is accepted.
