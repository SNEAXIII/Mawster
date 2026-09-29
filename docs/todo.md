# TODO

Out of scope of the feature that brought them up, parked here until picked up.

## Defense Plans

- **Auto-assign button** — fill every Champion-only node of a plan with its best available
  owner (7★ over 6★, then rank, then fewest defenders), honouring the defender cap and the
  one-Champion-per-map rule. The Strategist then corrects by hand.
- **Real-time plan editing over WebSocket** — two Strategists on the same plan see each
  other's placements live. Until then, node-level writes, last write wins, no lock.
