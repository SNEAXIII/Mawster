import { describe, expect, it } from 'vitest'
import { ChampionClass } from '@/app/lib/champion-class'
import { readableTextColor } from '@/app/tools/_lib/color'
import {
  EMPTY_FILTERS,
  type FilterState,
  hasActiveFilters,
  matchesFilters,
} from '@/app/tools/_lib/filters'
import { frameRarity } from '@/app/tools/_lib/tags'
import { board, champion, tags } from './fixtures'

const filters = (overrides: Partial<FilterState>): FilterState => ({
  ...EMPTY_FILTERS,
  ...overrides,
})

describe('hasActiveFilters', () => {
  it('is off for the empty filters and a blank query', () => {
    expect(hasActiveFilters(filters({ query: '   ' }))).toBe(false)
  })

  it.each<Partial<FilterState>>([
    { rarity: '7' },
    { query: 'herc' },
    { classes: [ChampionClass.MYSTIC] },
    { ascendable: true },
    { sagaAttacker: true },
    { sagaDefender: true },
    { tags: ['is_attacker'] },
  ])('is on for %j', (overrides) => {
    expect(hasActiveFilters(filters(overrides))).toBe(true)
  })
})

describe('matchesFilters', () => {
  const tagged = board({ tags: { hercules: tags({ is_attacker: true, is_defender: true }) } })

  it.each<[string, Partial<FilterState>, boolean]>([
    ['no filter', {}, true],
    ['its class', { classes: [ChampionClass.COSMIC, ChampionClass.TECH] }, true],
    ['another class', { classes: [ChampionClass.MYSTIC] }, false],
    ['7-star rarity', { rarity: '7' }, true],
    ['6-star-only rarity', { rarity: '6' }, false],
    ['ascendable', { ascendable: true }, false],
    ['saga attacker', { sagaAttacker: true }, true],
    ['saga defender', { sagaDefender: true }, false],
    ['every tag it carries', { tags: ['is_attacker', 'is_defender'] }, true],
    ['a tag it lacks', { tags: ['is_attacker', 'is_awakened'] }, false],
    ['a name prefix', { query: '  HERC ' }, true],
    ['its alias', { query: 'son of zeus' }, true],
    ['an unrelated query', { query: 'thor' }, false],
  ])('%s → %s', (_, overrides, expected) => {
    const hercules = champion({ alias: 'Son of Zeus', is_saga_attacker: true })

    expect(matchesFilters(hercules, filters(overrides), tagged)).toBe(expected)
  })

  it.each([
    ['aegon', 'Ægon'],
    ['eleve', 'Élève'],
  ])('finds %j in %j regardless of accents', (query, name) => {
    expect(matchesFilters(champion({ name }), filters({ query }), board())).toBe(true)
  })

  it('keeps a 6-star-only champion out of the 7-star pool', () => {
    const sixStar = champion({ is_7_stars_available: false })

    expect(matchesFilters(sixStar, filters({ rarity: '7' }), board())).toBe(false)
    expect(matchesFilters(sixStar, filters({ rarity: '6' }), board())).toBe(true)
  })
})

describe('frameRarity', () => {
  it.each([
    [true, '7r1'],
    [false, '6r1'],
  ])('7 stars available %s → %s frame', (is_7_stars_available, expected) => {
    expect(frameRarity(champion({ is_7_stars_available }))).toBe(expected)
  })
})

describe('readableTextColor', () => {
  it.each([
    ['#ffff7f', '#000000'],
    ['#fff', '#000000'],
    ['#1e3a8a', '#f8fafc'],
    ['#000', '#f8fafc'],
    ['not a colour', '#f8fafc'],
  ])('on %s → %s', (background, expected) => {
    expect(readableTextColor(background)).toBe(expected)
  })
})
