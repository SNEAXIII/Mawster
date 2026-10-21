import { describe, expect, it } from 'vitest'
import { blockingRows, isValidRarity, rowIssues } from '@/components/roster/import-row-validation'
import {
  applyRosterFilters,
  EMPTY_FILTERS,
  isFilterActive,
  optionRange,
  optionSlice,
  RANK_OPTIONS,
  type RosterFilters,
} from '@/components/roster/roster-filters'
import type { PreviewRow } from '@/components/roster/import-preview-row'
import type { RosterEntry } from '@/app/services/roster'

const row = (over: Partial<PreviewRow>): PreviewRow => ({
  champion_name: 'Storm',
  champion_class: 'Mutant',
  image_url: null,
  newRarity: '7r3',
  newSignature: 0,
  oldRarity: null,
  oldSignature: null,
  isNew: true,
  hasChanges: false,
  ...over,
})

describe('import row validation', () => {
  it.each([
    ['7r6', true],
    ['6r4', true],
    ['6r3', false],
    ['7R3', false],
  ])('isValidRarity(%s) → %s', (rarity, expected) => {
    expect(isValidRarity(rarity)).toBe(expected)
  })

  it('reports every issue of a row', () => {
    expect(rowIssues(row({}))).toEqual([])
    expect(rowIssues(row({ champion_name: '  ', newRarity: '5r1' }))).toEqual([
      'missingName',
      'invalidRarity',
    ])
  })

  it('blocks only invalid rows that would be sent', () => {
    const bad = { newRarity: 'x' }
    const blocking = row({ ...bad, champion_name: 'new' })
    const changed = row({ ...bad, champion_name: 'changed', isNew: false, hasChanges: true })
    const rows = [
      blocking,
      changed,
      row({ ...bad, ignored: true }),
      row({ ...bad, isNew: false, hasChanges: false }),
      row({}),
    ]
    expect(blockingRows(rows)).toEqual([blocking, changed])
  })
})

const entry = (over: Partial<RosterEntry>): RosterEntry => ({
  id: over.champion_name ?? 'x',
  game_account_id: 'acc',
  champion_id: 'c',
  rarity: '7r3',
  signature: 0,
  champion_name: 'Storm',
  champion_class: 'Mutant',
  alias: null,
  image_url: null,
  is_preferred_attacker: false,
  ascension: 0,
  is_ascendable: false,
  has_prefight: false,
  is_saga_attacker: false,
  is_saga_defender: false,
  ...over,
})

describe('roster filters', () => {
  it('is inactive when empty or the name is blank', () => {
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTERS, name: '   ' })).toBe(false)
  })

  it.each<Partial<RosterFilters>>([
    { name: 'st' },
    { ranks: ['7r3'] },
    { ascensions: [1] },
    { championClass: 'Tech' },
    { sagaAttacker: true },
    { sagaDefender: true },
    { preferredAttacker: true },
    { minSignature: 20 },
    { maxSignature: 199 },
  ])('is active with %j', (over) => {
    expect(isFilterActive({ ...EMPTY_FILTERS, ...over })).toBe(true)
  })

  const roster = [
    entry({
      champion_name: 'Storm',
      alias: 'Ororo',
      rarity: '7r3',
      signature: 200,
      is_saga_attacker: true,
    }),
    entry({
      champion_name: 'Iron Man',
      champion_class: 'Tech',
      rarity: '7r4',
      ascension: 1,
      is_preferred_attacker: true,
    }),
    entry({
      champion_name: 'Hulk',
      champion_class: 'Science',
      signature: 20,
      is_saga_defender: true,
    }),
  ]
  const names = (f: Partial<RosterFilters>) =>
    applyRosterFilters(roster, { ...EMPTY_FILTERS, ...f }).map((e) => e.champion_name)

  it.each<[Partial<RosterFilters>, string[]]>([
    [{}, ['Storm', 'Iron Man', 'Hulk']],
    [{ name: ' IRON ' }, ['Iron Man']],
    [{ name: 'oro' }, ['Storm']],
    [{ ranks: ['7r4'] }, ['Iron Man']],
    [{ ascensions: [1] }, ['Iron Man']],
    [{ championClass: 'Science' }, ['Hulk']],
    [{ sagaAttacker: true }, ['Storm']],
    [{ sagaDefender: true }, ['Hulk']],
    [{ preferredAttacker: true }, ['Iron Man']],
    [{ minSignature: 100 }, ['Storm']],
    [{ maxSignature: 20 }, ['Iron Man', 'Hulk']],
    [{ minSignature: 1, maxSignature: 100 }, ['Hulk']],
    [{ minSignature: 1, championClass: 'Mutant' }, ['Storm']],
  ])('%j → %j', (filters, expected) => {
    expect(names(filters)).toEqual(expected)
  })
})

describe('option range', () => {
  it('maps an empty selection to the full range and back', () => {
    expect(optionRange(RANK_OPTIONS, [])).toEqual([0, 5])
    expect(optionSlice(RANK_OPTIONS, [0, 5])).toEqual([])
  })

  it('round-trips a partial range', () => {
    expect(optionSlice(RANK_OPTIONS, [2, 4])).toEqual(['7r3', '7r4', '7r5'])
    expect(optionRange(RANK_OPTIONS, ['7r5', '7r3', '7r4'])).toEqual([2, 4])
  })
})
