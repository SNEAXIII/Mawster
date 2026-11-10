# Tier lists live in the browser

Tier lists used to be saved to the Account (`0014`): four tables, five endpoints, and a
dialog to bring a signed-out board over on sign in. In production, 136 Accounts held a
list but only 9 had ranked a single Champion: opening the page created an empty one.

A Tier List is now kept in the browser's `localStorage`, up to twenty, signed in or not,
with the same picker as before. The backend holds none. A list moves to another browser
or another person as an exported file.

## Consequences

Clearing site data, or switching browser or device, loses the lists that were not
exported. Bringing them back to the server means the tables, the endpoints and their
tests again, for a feature a handful of players use: it needs demand first, not just
a second device.
