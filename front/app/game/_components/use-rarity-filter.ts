'use client'

import { useCallback, useMemo } from 'react'
import { parseRarity } from '@/app/game/defense/_components/defense-utils'
import { RARITIES } from '@/app/services/roster'
import { useStoredValue } from '@/hooks/use-stored-value'

/** Inclusive [lo, hi] indexes into RARITIES. */
export type RankRange = [number, number]

/** Default when no stored preference: 7r1 – 7r6, so 6★ is hidden. */
const DEFAULT_RANGE: RankRange = [RARITIES.indexOf('7r1'), RARITIES.indexOf('7r6')]
/** Sort weight for a rarity string: 7r6 (706) → 6r4 (604). */
export function rarityWeight(rarity: string): number {
  const { stars, rank } = parseRarity(rarity)
  return stars * 100 + rank
}

const isIndex = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) < RARITIES.length

export function parseRankRange(raw: unknown): RankRange {
  if (Array.isArray(raw) && raw.length === 2 && raw.every(isIndex))
    return [Math.min(...raw), Math.max(...raw)]
  return DEFAULT_RANGE
}

/**
 * Manages a persisted rarity-rank range for a champion selector.
 * State lives in localStorage under `storageKey`, is independent of dialog
 * open/close, and is meant to survive "Reset filters".
 */
export function useRarityFilter(storageKey: string) {
  const [range, setRange] = useStoredValue(storageKey, parseRankRange, DEFAULT_RANGE)

  const matches = useCallback(
    (rarity: string) => {
      const { stars, rank } = parseRarity(rarity)
      const index = RARITIES.findIndex((r) => r === `${stars}r${rank}`)
      return index >= range[0] && index <= range[1]
    },
    [range]
  )

  return useMemo(() => ({ range, setRange, matches }), [range, setRange, matches])
}
