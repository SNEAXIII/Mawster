import { RosterEntry } from '@/app/services/roster'

export interface RosterFilters {
  name: string
  ranks: string[]
  ascensions: number[]
  championClass: string
  sagaAttacker: boolean
  sagaDefender: boolean
  preferredAttacker: boolean
  awakened: boolean
  minSignature: number
}

export const RANK_OPTIONS = ['7r1', '7r2', '7r3', '7r4', '7r5', '7r6'] as const
export const ASCENSION_OPTIONS = [0, 1, 2] as const

export const EMPTY_FILTERS: RosterFilters = {
  name: '',
  ranks: [],
  ascensions: [],
  championClass: '',
  sagaAttacker: false,
  sagaDefender: false,
  preferredAttacker: false,
  awakened: false,
  minSignature: 0,
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
    f.awakened ||
    f.minSignature > 0
  )
}

export function applyRosterFilters(roster: RosterEntry[], f: RosterFilters): RosterEntry[] {
  const q = f.name.trim().toLowerCase()
  return roster.filter((e) => {
    if (
      q &&
      !e.champion_name.toLowerCase().includes(q) &&
      !(e.alias?.toLowerCase().includes(q) ?? false)
    )
      return false
    if (f.ranks.length > 0 && !f.ranks.includes(e.rarity)) return false
    if (f.ascensions.length > 0 && !f.ascensions.includes(e.ascension)) return false
    if (f.championClass && e.champion_class !== f.championClass) return false
    if (f.sagaAttacker && !e.is_saga_attacker) return false
    if (f.sagaDefender && !e.is_saga_defender) return false
    if (f.preferredAttacker && !e.is_preferred_attacker) return false
    if (f.awakened && e.signature <= 0) return false
    if (e.signature < f.minSignature) return false
    return true
  })
}
