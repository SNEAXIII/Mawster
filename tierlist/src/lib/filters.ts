import type { AttributeKey, BoardState, Champion, ChampionClass } from './types'
import { attributesOf } from './board'

export interface FilterState {
  query: string
  /** Empty means "every class"; otherwise the champion's class must be in here. */
  classes: ChampionClass[]
  ascendable: boolean
  sevenStar: boolean
  prefight: boolean
  /** Champion must carry every selected attribute. */
  attributes: AttributeKey[]
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  classes: [],
  ascendable: false,
  sevenStar: false,
  prefight: false,
  attributes: [],
}

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.query.trim() !== '' ||
    f.classes.length > 0 ||
    f.ascendable ||
    f.sevenStar ||
    f.prefight ||
    f.attributes.length > 0
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
  champion: Champion,
  filters: FilterState,
  board: BoardState
): boolean {
  if (filters.classes.length > 0 && !filters.classes.includes(champion.championClass)) return false
  if (filters.ascendable && !champion.isAscendable) return false
  if (filters.sevenStar && !champion.isSevenStar) return false
  if (filters.prefight && !champion.hasPrefight) return false

  if (filters.attributes.length > 0) {
    const { flags } = attributesOf(board, champion.id)
    if (!filters.attributes.every((key) => flags[key])) return false
  }

  const query = fold(filters.query.trim())
  if (query === '') return true
  return fold(`${champion.name} ${champion.alias}`).includes(query)
}
