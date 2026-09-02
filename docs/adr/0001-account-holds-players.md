# An Account holds Players, and moderation stops at the Account

Mawster separates the login (`user`) from the in-game identity (`game_account`): one
Account binds up to ten Players, and everything in the game domain — alliance
membership, roster, war actions, authorship — points at a Player, never at an Account.
Moderation deliberately sits one level up, on the Account: a mute silences every Player
bound to it.

## Consequences

Moderation is coarser than the game domain, on purpose. Sanctioning the author of a
reported Fight Note hits all of their Players at once, while an alliance-level action
(demoting an Officer, removing a member) touches exactly one. A reader who expects
moderation to be per-Player will find the schema inconsistent; it is not.

The ten-Player cap is an arbitrary anti-abuse limit, not a game rule.
