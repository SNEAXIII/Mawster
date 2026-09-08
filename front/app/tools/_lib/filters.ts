import { tagsOf } from './board'
import type { BoardState, CatalogChampion, ChampionClass, TagKey } from './types'

export interface FilterState {
  query: string
  /** Empty means "every class"; otherwise the champion's class must be in here. */
  classes: ChampionClass[]
  ascendable: boolean
  prefight: boolean
  saga: boolean
  /** Champion must carry every selected tag. */
  tags: TagKey[]
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  classes: [],
  ascendable: false,
  prefight: false,
  saga: false,
  tags: [],
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.classes.length > 0 ||
    filters.ascendable ||
    filters.prefight ||
    filters.saga ||
    filters.tags.length > 0
  )
}

/** Fold accents and punctuation so "aegon" finds "Ægon" and "abo" finds "Abomination". */
function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
}

export function matchesFilters(
  champion: CatalogChampion,
  filters: FilterState,
  board: BoardState
): boolean {
  if (
    filters.classes.length > 0 &&
    !filters.classes.includes(champion.champion_class as ChampionClass)
  ) {
    return false
  }
  if (filters.ascendable && !champion.is_ascendable) return false
  if (filters.prefight && !champion.has_prefight) return false
  if (filters.saga && !champion.is_saga_attacker && !champion.is_saga_defender) return false

  if (filters.tags.length > 0) {
    const tags = tagsOf(board, champion.id)
    if (!filters.tags.every((key) => tags[key])) return false
  }

  const query = fold(filters.query.trim())
  if (query === '') return true
  return fold(`${champion.name} ${champion.alias ?? ''}`).includes(query)
}

export { TAG_KEYS } from './types'
