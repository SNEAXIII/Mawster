'use client'

import { RARITIES } from '@/app/services/roster'
import { useStoredValue } from '@/hooks/use-stored-value'

export interface DefenderRarity {
  stars: number
  rank: number
  ascension: number
}

const STORAGE_KEY = 'mawster:war-defender-last-rarity'
const DEFAULT_RARITY: DefenderRarity = { stars: 7, rank: 3, ascension: 0 }

/** Falls back field by field: a bad rarity keeps a good ascension and vice versa. */
export function parseDefenderRarity(raw: unknown): DefenderRarity {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_RARITY
  const { stars, rank, ascension } = raw as Partial<Record<keyof DefenderRarity, unknown>>
  const known = (RARITIES as readonly string[]).includes(`${stars}r${rank}`)
  const validAscension = Number.isInteger(ascension) && [0, 1, 2].includes(ascension as number)
  return {
    stars: known ? (stars as number) : DEFAULT_RARITY.stars,
    rank: known ? (rank as number) : DEFAULT_RARITY.rank,
    ascension: validAscension ? (ascension as number) : DEFAULT_RARITY.ascension,
  }
}

/** Last rank/ascension a war defender was recorded with, shared by the selector and the quick edit. */
export function useLastDefenderRarity() {
  const [last, remember] = useStoredValue(STORAGE_KEY, parseDefenderRarity, DEFAULT_RARITY)
  return { last, remember }
}
