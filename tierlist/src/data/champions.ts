import raw from './champions.json'
import { HARD_BANNED_IDS, NOT_SEVEN_STAR_IDS } from './overrides'
import type { Champion } from '@/lib/types'

const banned = new Set(HARD_BANNED_IDS)
const notSevenStar = new Set(NOT_SEVEN_STAR_IDS)

/**
 * The champion roster the app works with: the generated fixture minus the
 * non-playable entries, with the hand-maintained 7-star exceptions applied.
 * Sorted by name so the pool has a stable order before any filter runs.
 */
export const CHAMPIONS: Champion[] = (raw as Champion[])
  .filter((c) => !banned.has(c.id))
  .map((c) => ({ ...c, isSevenStar: c.isSevenStar && !notSevenStar.has(c.id) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const CHAMPIONS_BY_ID = new Map(CHAMPIONS.map((c) => [c.id, c]))

/** Champions dropped as non-playable — surfaced in the About panel so the list stays auditable. */
export const BANNED_COUNT = (raw as Champion[]).length - CHAMPIONS.length
