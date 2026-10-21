import type { RosterEntry } from '@/app/services/roster'

export interface RosterFilters {
  name: string
  ranks: string[]
  ascensions: number[]
  championClass: string
  sagaAttacker: boolean
  sagaDefender: boolean
  preferredAttacker: boolean
  minSignature: number
  maxSignature: number
}

export const RANK_OPTIONS = ['7r1', '7r2', '7r3', '7r4', '7r5', '7r6'] as const
export const ASCENSION_OPTIONS = [0, 1, 2] as const
export const MAX_SIGNATURE = 200

export const EMPTY_FILTERS: RosterFilters = {
  name: '',
  ranks: [],
  ascensions: [],
  championClass: '',
  sagaAttacker: false,
  sagaDefender: false,
  preferredAttacker: false,
  minSignature: 0,
  maxSignature: MAX_SIGNATURE,
}

/** Slider indexes `[lo, hi]` covered by `selected`; nothing selected means the full range. */
export function optionRange<T>(options: readonly T[], selected: readonly T[]): [number, number] {
  if (selected.length === 0) return [0, options.length - 1]
  const indexes = selected.map((s) => options.indexOf(s))
  return [Math.min(...indexes), Math.max(...indexes)]
}

/** Options between slider indexes `lo` and `hi`; the full range means no filter. */
export function optionSlice<T>(options: readonly T[], [lo, hi]: [number, number]): T[] {
  return lo === 0 && hi === options.length - 1 ? [] : options.slice(lo, hi + 1)
}

export function isFilterActive(f: RosterFilters): boolean {
  return (
    f.name.trim() !== '' ||
    f.ranks.length > 0 ||
    f.ascensions.length > 0 ||
    f.championClass !== '' ||
    f.sagaAttacker ||
    f.sagaDefender ||
    f.preferredAttacker ||
    f.minSignature > 0 ||
    f.maxSignature < MAX_SIGNATURE
  )
}

const matchesName = (e: RosterEntry, q: string) =>
  !q || e.champion_name.toLowerCase().includes(q) || (e.alias?.toLowerCase().includes(q) ?? false)

export function applyRosterFilters(roster: RosterEntry[], f: RosterFilters): RosterEntry[] {
  const q = f.name.trim().toLowerCase()
  return roster.filter((e) => {
    if (!matchesName(e, q)) return false
    if (f.ranks.length > 0 && !f.ranks.includes(e.rarity)) return false
    if (f.ascensions.length > 0 && !f.ascensions.includes(e.ascension)) return false
    if (f.championClass && e.champion_class !== f.championClass) return false
    if (f.sagaAttacker && !e.is_saga_attacker) return false
    if (f.sagaDefender && !e.is_saga_defender) return false
    if (f.preferredAttacker && !e.is_preferred_attacker) return false
    if (e.signature < f.minSignature || e.signature > f.maxSignature) return false
    return true
  })
}
