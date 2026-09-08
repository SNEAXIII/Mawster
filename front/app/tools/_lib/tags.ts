import type { StarMode } from '../_hooks/use-prefs'
import type { CatalogChampion, TagKey } from './types'

/**
 * How each tag is drawn — the short code the game uses and the chip colour.
 *
 * One table for the card badges and the champion sheet: a tag that reads ATK on
 * a card and something else in the sheet is the drift this exists to prevent.
 */
export interface TagDisplay {
  code: string
  /** Chip classes when the tag is set. */
  tone: string
}

export const TAG_DISPLAY: Record<TagKey, TagDisplay> = {
  is_attacker: { code: 'ATK', tone: 'bg-rose-500/90 text-white' },
  is_defender: { code: 'DEF', tone: 'bg-sky-500/90 text-white' },
  is_alliance_war: { code: 'AW', tone: 'bg-amber-500/90 text-black' },
  is_battlegrounds: { code: 'BG', tone: 'bg-green-500/90 text-black' },
  is_awakened: { code: 'AWK', tone: 'bg-cyan-400 text-black' },
}

/**
 * Derived, never set: a champion marked both attacker and defender is a dual
 * threat, and shows that instead of the two — three chips saying the same thing
 * is noise.
 */
export const DUAL_DISPLAY: TagDisplay = { code: 'DUAL', tone: 'bg-violet-500/90 text-white' }

/**
 * Marker artwork, served next to the portraits and the star frames.
 *
 * The game's own glyphs rather than a vector icon set: a generic sword next to
 * in-game art reads as a placeholder.
 */
const ICON_DIR = '/static/icons'

export const TAG_ICON: Record<TagKey, string> = {
  is_attacker: `${ICON_DIR}/atk-sword.png`,
  is_defender: `${ICON_DIR}/def-shield.png`,
  is_alliance_war: `${ICON_DIR}/aw-flame.png`,
  is_battlegrounds: `${ICON_DIR}/bg-helmet.png`,
  is_awakened: `${ICON_DIR}/awk-gem.png`,
}

/** Shown in place of the attacker and defender glyphs when a champion has both. */
export const DUAL_ICON = `${ICON_DIR}/dual-sword-shield.png`

/** Signature levels players actually stop at. */
export const SIGNATURE_PRESETS = [20, 60, 100, 200]

/**
 * Which star frame a champion is drawn in.
 *
 * Left to the catalog by default — a champion with no 7-star version shows the
 * 6★ frame — until the reader asks for one frame throughout.
 */
export function frameRarity(champion: CatalogChampion, starMode: StarMode = 'all'): string {
  if (starMode === '7') return '7r1'
  if (starMode === '6') return '6r1'
  return champion.is_7_star ? '7r1' : '6r1'
}
