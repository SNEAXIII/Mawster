import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeBoard, TIER_PALETTE } from '@/app/tools/_lib/board'
import { boardFilename, importJson } from '@/app/tools/_lib/export'
import { tags } from './fixtures'

const KNOWN = new Set(['hercules', 'thor'])

const fileOf = (content: string) => new File([content], 'board.json')

// Both read an untrusted board back (localStorage, an uploaded file) and share one contract.
describe.each([
  { parser: 'normalizeBoard', parse: async (raw: unknown) => normalizeBoard(raw, KNOWN) },
  { parser: 'importJson', parse: (raw: unknown) => importJson(fileOf(JSON.stringify(raw)), KNOWN) },
])('$parser', ({ parse }) => {
  it('drops unknown champions and keeps each champion in its first row only', async () => {
    const result = await parse({
      title: 'Imported',
      tiers: [
        { label: 'S', color: '#111', championIds: ['hercules', 'retired', 'hercules', 42] },
        { label: 'A', color: '#222', championIds: ['thor', 'hercules'] },
      ],
    })

    expect(result?.title).toBe('Imported')
    expect(result?.tiers.map(({ label, championIds }) => [label, championIds])).toEqual([
      ['S', ['hercules']],
      ['A', ['thor']],
    ])
  })

  it('skips malformed rows and treats missing champion lists as empty', async () => {
    const result = await parse({ tiers: [null, { color: '#111' }, { label: 'S' }] })

    expect(result?.title).toBe('')
    expect(result?.tiers).toHaveLength(1)
    expect(result?.tiers[0]).toMatchObject({ label: 'S', championIds: [] })
  })

  it('keeps only the tags of known champions that carry a mark, filling missing keys', async () => {
    const result = await parse({
      tiers: [{ label: 'S', championIds: [] }],
      tags: {
        hercules: { is_attacker: true },
        thor: { is_attacker: false },
        retired: { is_defender: true },
        loki: 'not an object',
      },
    })

    expect(result?.tags).toEqual({ hercules: tags({ is_attacker: true }) })
  })

  it.each([
    ['null', null],
    ['a number', 42],
    ['no tiers', { title: 'x' }],
    ['no valid row', { tiers: [null, { color: '#111' }] }],
  ])('rejects %s', async (_, raw) => {
    expect(await parse(raw)).toBeNull()
  })
})

describe('normalizeBoard', () => {
  it('keeps the saved ids and falls back to the palette colour', () => {
    const result = normalizeBoard(
      { id: 'list-1', tiers: [{ label: 'S' }, { id: 'kept', label: 'A' }] },
      KNOWN
    )

    expect(result?.id).toBe('list-1')
    expect(result?.tiers[0].id).toMatch(/^tier-/)
    expect(result?.tiers[1].id).toBe('kept')
    expect(result?.tiers.map((tier) => tier.color)).toEqual(TIER_PALETTE.slice(0, 2))
  })
})

describe('importJson', () => {
  it('numbers the rows and falls back to white', async () => {
    const result = await importJson(fileOf(JSON.stringify({ tiers: [{ label: 'S' }] })), KNOWN)

    expect(result?.tiers[0]).toMatchObject({ id: 'imported-0', color: '#ffffff' })
  })

  it('rejects a file that is not JSON', async () => {
    expect(await importJson(fileOf('{not json'), KNOWN)).toBeNull()
  })
})

describe('boardFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['My AW Board!', 'my-aw-board-2026-10-04.json'],
    ['  --AW & co--  ', 'aw-co-2026-10-04.json'],
    ['', 'tier-list-2026-10-04.json'],
    ['!!!', 'tier-list-2026-10-04.json'],
  ])('slugs %j as %s', (title, expected) => {
    expect(boardFilename(title, 'json')).toBe(expected)
  })
})
