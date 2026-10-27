'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseRarity } from '@/app/game/defense/_components/defense-utils'
import { RARITIES } from '@/app/services/roster'

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

function toRange(indexes: number[]): RankRange | null {
  if (indexes.length === 0) return null
  return [Math.min(...indexes), Math.max(...indexes)]
}

/** Current format is `[lo, hi]`; the legacy format is an array of tier strings. */
export function parseRankRange(raw: unknown): RankRange {
  if (!Array.isArray(raw)) return DEFAULT_RANGE
  if (raw.length === 2 && raw.every(isIndex)) return toRange(raw) ?? DEFAULT_RANGE
  const legacy = raw.flatMap((tier) => {
    const index = RARITIES.findIndex((r) => r === tier)
    return index === -1 ? [] : [index]
  })
  return toRange(legacy) ?? DEFAULT_RANGE
}

function loadRange(storageKey: string): RankRange {
  if (typeof window === 'undefined') return DEFAULT_RANGE
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) return parseRankRange(JSON.parse(raw))
  } catch {
    // Corrupt / unavailable storage — fall back to default.
  }
  return DEFAULT_RANGE
}

/**
 * Manages a persisted rarity-rank range for a champion selector.
 * State lives in localStorage under `storageKey`, is independent of dialog
 * open/close (loaded once on mount), and is meant to survive "Reset filters".
 */
export function useRarityFilter(storageKey: string) {
  const [range, setState] = useState<RankRange>(DEFAULT_RANGE)

  // Hydrate from storage on mount (avoids SSR mismatch).
  useEffect(() => {
    setState(loadRange(storageKey))
  }, [storageKey])

  const setRange = useCallback(
    (next: RankRange) => {
      setState(next)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Ignore storage failures (private browsing).
      }
    },
    [storageKey]
  )

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
