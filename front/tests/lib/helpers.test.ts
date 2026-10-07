import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  EMPTY_FILTERS,
  type ChampionFiltersState,
} from '@/app/admin/_viewmodels/champion-filters'
import {
  ChampionClass,
  getClassColors,
  getClassIconUrl,
  sortByClassOrder,
} from '@/app/lib/champion-class'
import { cn, formatDate, truncateString } from '@/app/lib/utils'

describe('countActiveFilters', () => {
  it.each<[Partial<ChampionFiltersState>, number]>([
    [{}, 0],
    [{ search: 'herc' }, 0],
    [{ championClass: ChampionClass.MYSTIC }, 1],
    [{ is_ascendable: 'true', has_prefight: 'false' }, 2],
    [{ championClass: ChampionClass.TECH, is_saga_attacker: 'true' }, 2],
  ])('%j → %i', (overrides, expected) => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, ...overrides })).toBe(expected)
  })
})

describe('champion class', () => {
  it('colours a known class and falls back to grey for an unknown one', () => {
    expect(getClassColors('Mystic').bg).toBe('bg-purple-600')
    expect(getClassColors('Unknown').bg).toBe('bg-gray-500')
  })

  it.each([
    ['Cosmic', '/static/icons/class-cosmic.webp'],
    ['Unknown', null],
  ])('icon of %s → %s', (championClass, expected) => {
    expect(getClassIconUrl(championClass)).toBe(expected)
  })

  it('sorts classes along the in-game wheel, unknown ones last alphabetically', () => {
    expect(sortByClassOrder(['Zeta', 'Mystic', 'Alpha', 'Cosmic', 'Tech'])).toEqual([
      'Cosmic',
      'Tech',
      'Mystic',
      'Alpha',
      'Zeta',
    ])
  })
})

describe('cn', () => {
  it('drops falsy classes and lets the last conflicting utility win', () => {
    expect(cn('px-2 text-sm', false, null, 'px-4')).toBe('text-sm px-4')
  })
})

describe('truncateString', () => {
  it.each([
    ['short', 10, 'short'],
    ['exactly10!', 10, 'exactly10!'],
    ['much longer text', 4, 'much...'],
  ])('%j at %i → %j', (str, maxLength, expected) => {
    expect(truncateString(str, maxLength)).toBe(expected)
  })
})

describe('formatDate', () => {
  // Midday UTC keeps the calendar day the same in every timezone the CI could run in.
  const date = '2026-10-04T12:00:00Z'

  it.each([
    ['en', 'short', 'October 4, 2026'],
    ['en', 'medium', 'Oct 4, 2026'],
    ['fr', 'short', '4 octobre 2026'],
    ['fr', 'medium', '4 oct. 2026'],
  ] as const)('%s %s → %s', (locale, preset, expected) => {
    expect(formatDate(date, locale, preset)).toBe(expected)
  })
})
