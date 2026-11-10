export { CLASS_ORDER as CHAMPION_CLASSES } from '@/app/lib/champion-class'

/** The tags a champion carries in one tier list; its id is the key of the map holding them. */
export interface ChampionTags {
  is_attacker: boolean
  is_defender: boolean
  is_alliance_war: boolean
  is_battlegrounds: boolean
  is_awakened: boolean
  signature: number
}

export const NO_TAGS: ChampionTags = {
  is_attacker: false,
  is_defender: false,
  is_alliance_war: false,
  is_battlegrounds: false,
  is_awakened: false,
  signature: 0,
}

/** Every tag key that is a plain on/off mark — signature is set apart, it holds a value. */
export const TAG_KEYS = [
  'is_attacker',
  'is_defender',
  'is_alliance_war',
  'is_battlegrounds',
  'is_awakened',
] as const

export type TagKey = (typeof TAG_KEYS)[number]

export interface BoardTier {
  id: string
  label: string
  color: string
  /** Champion ids in this row, in display order. */
  championIds: string[]
}

/** The board as the page holds it, and as the browser stores it. */
export interface BoardState {
  /** The tier list this board is saved to; null until its first change creates one. */
  id: string | null
  title: string
  tiers: BoardTier[]
  tags: Record<string, ChampionTags>
}

/** True when a champion carries at least one mark worth storing. */
export function hasAnyTag(tags: ChampionTags): boolean {
  return TAG_KEYS.some((key) => tags[key]) || tags.signature > 0
}

export type { CatalogChampion } from '@/app/services/tierlist'
