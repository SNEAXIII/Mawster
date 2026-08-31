/**
 * Hand-maintained corrections applied on top of `champions.json`.
 *
 * `champions.json` is generated from the Mawster API fixture, which only knows
 * a champion's name, class, portrait, alias and its ascension / prefight flags.
 * Everything the tier list needs beyond that lives here, keyed by champion id
 * (the slug of the name — see `scripts/build-champions.mjs`).
 */

/**
 * Champions present in the fixture that a player can never own: event bosses,
 * minions and story-mode stand-ins. They are dropped from the app entirely —
 * they never show in the pool, the filters or an exported board.
 *
 * ⚠️ Review this list: it is a best-effort starting point, not authoritative
 * game data. Add an id here to hide a champion, remove one to bring it back.
 */
export const HARD_BANNED_IDS: readonly string[] = [
  'anti-venomoid',
  'doombot',
  'sentinelbot',
  'symbioid',
]

/**
 * Champions NOT available as 7-star, by id. `champions.json` ships every
 * champion as 7-star available, so this list is the exception set behind the
 * "7★ only" filter.
 *
 * ⚠️ Empty on purpose: the fixture carries no 7-star data. Fill it in (or
 * regenerate `champions.json` from an export that has `is_7_star`) to make the
 * filter meaningful.
 */
export const NOT_SEVEN_STAR_IDS: readonly string[] = []
