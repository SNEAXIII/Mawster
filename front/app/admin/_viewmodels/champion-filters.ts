import type { BoolFilter } from '@/app/services/champions'

export const BASE_SIZE = 10

export type ChampionAttribute =
  | 'is_7_stars_available'
  | 'is_ascendable'
  | 'has_prefight'
  | 'is_saga_attacker'
  | 'is_saga_defender'

export interface ChampionFiltersState {
  championClass: string
  search: string
  is_7_stars_available: BoolFilter
  is_ascendable: BoolFilter
  has_prefight: BoolFilter
  is_saga_attacker: BoolFilter
  is_saga_defender: BoolFilter
}

export const BOOL_FILTER_KEYS: ChampionAttribute[] = [
  'is_7_stars_available',
  'is_ascendable',
  'has_prefight',
  'is_saga_attacker',
  'is_saga_defender',
]

/** Filters the API refuses without a season_id. */
export const SAGA_FILTER_KEYS: ChampionAttribute[] = ['is_saga_attacker', 'is_saga_defender']

export const EMPTY_FILTERS: ChampionFiltersState = {
  championClass: 'all',
  search: '',
  is_7_stars_available: 'all',
  is_ascendable: 'all',
  has_prefight: 'all',
  is_saga_attacker: 'all',
  is_saga_defender: 'all',
}

export function countActiveFilters(filters: ChampionFiltersState): number {
  const bools = BOOL_FILTER_KEYS.filter((key) => filters[key] !== 'all').length
  return bools + (filters.championClass !== 'all' ? 1 : 0)
}
