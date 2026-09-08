# The champion catalog is public

`GET /catalog/champions` answers without a token, and the front's proxy carries it through
without a session. Everything else the API serves is behind the JWT.

The tier list is the reason. It replaces a standalone app that ran with no account at all, and a
page that demands a login before showing anything has lost the audience it was built for: a
player deciding whether Mawster is worth signing up for, and one following a link to somebody
else's ranking.

What travels is what the game already tells everyone — a champion's name, class, portrait, alias,
ascension and rarity flags — plus the saga roles of the season now running. The response is an
explicit field list rather than a serialized model, so a column added to `champion` does not leak
by simply existing.

## Consequences

Anything that reaches this endpoint is public for good. Adding a field to `CatalogChampionResponse`
is a publishing decision, not a refactor, and a field that says something about a Player, an
Alliance or an Account has no place in it — the endpoint would have to be split rather than
extended.

Closing it later is not a code change but a broken page: links to a shared tier list would start
demanding a login. The two are now tied together — the catalog stays open as long as the tier list
is meant to be read without an account.

Nothing else was opened. `/stats/public` was the only unauthenticated path before this, and the
proxy's `PUBLIC_PATHS` set is where that list lives, so opening a third one is a deliberate edit
in one place rather than a scattered decision.
