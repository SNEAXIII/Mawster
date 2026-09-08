import type { CatalogChampion, TierListSavePayload, TierListTag } from '@/app/services/tierlist'

/** The six champion classes, in the order the class filter shows them. */
export const CHAMPION_CLASSES = ['Cosmic', 'Tech', 'Mutant', 'Skill', 'Science', 'Mystic'] as const

export type ChampionClass = (typeof CHAMPION_CLASSES)[number]

/**
 * The tags a champion carries in one tier list, without the champion id the API
 * response carries — here the id is the key of the map holding them.
 */
export type ChampionTags = Omit<TierListTag, 'champion_id'>

export const NO_TAGS: ChampionTags = {
  is_six_star_only: false,
  is_attacker: false,
  is_defender: false,
  is_alliance_war: false,
  is_battlegrounds: false,
  is_awakened: false,
  signature: 0,
}

/** Every tag key that is a plain on/off mark — signature is set apart, it holds a value. */
export const TAG_KEYS = [
  'is_six_star_only',
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

/** The board as the page holds it, before it is sent back as a whole. */
export interface BoardState {
  /** The tier list this board is saved to; null while it lives only in the browser. */
  id: string | null
  title: string
  tiers: BoardTier[]
  tags: Record<string, ChampionTags>
}

/** What the save endpoint expects, built from the board the page holds. */
export function toSavePayload(board: BoardState): TierListSavePayload {
  return {
    title: board.title,
    tiers: board.tiers.map((tier) => ({
      label: tier.label,
      color: tier.color,
      champion_ids: tier.championIds,
    })),
    tags: Object.entries(board.tags).map(([champion_id, tags]) => ({ champion_id, ...tags })),
  }
}

/** True when a champion carries at least one mark worth storing. */
export function hasAnyTag(tags: ChampionTags): boolean {
  return TAG_KEYS.some((key) => tags[key]) || tags.signature > 0
}

export type { CatalogChampion }
