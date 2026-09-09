import type { BoolFilter } from '@/app/services/champions'
import { CHAMPION_ATTRIBUTE_KEYS, type ChampionAttribute } from './champion-attributes'

export const BASE_SIZE = 10

export type ChampionFiltersState = { championClass: string; search: string } & Record<
  ChampionAttribute,
  BoolFilter
>

export const EMPTY_FILTERS: ChampionFiltersState = {
  championClass: 'all',
  search: '',
  ...(Object.fromEntries(CHAMPION_ATTRIBUTE_KEYS.map((key) => [key, 'all'])) as Record<
    ChampionAttribute,
    BoolFilter
  >),
}

export function countActiveFilters(filters: ChampionFiltersState): number {
  const bools = CHAMPION_ATTRIBUTE_KEYS.filter((key) => filters[key] !== 'all').length
  return bools + (filters.championClass !== 'all' ? 1 : 0)
}
