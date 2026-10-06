import { describe, expect, it } from 'vitest'
import {
  defaultBoard,
  forgetStoredBoard,
  fromDetail,
  loadStoredBoard,
  rankedIds,
  storeBoard,
  tagsOf,
  TIER_PALETTE,
} from '@/app/tools/_lib/board'
import { readStored } from '@/app/tools/_lib/storage'
import { hasAnyTag, NO_TAGS, toSavePayload } from '@/app/tools/_lib/types'
import { board, stubLocalStorage, tags } from './fixtures'

const KNOWN = new Set(['hercules'])

describe('defaultBoard', () => {
  it('starts unsaved with the S to D rows in palette order', () => {
    const result = defaultBoard()

    expect(result).toMatchObject({ id: null, title: '', tags: {} })
    expect(result.tiers.map(({ label, color }) => [label, color])).toEqual(
      ['S', 'A', 'B', 'C', 'D'].map((label, i) => [label, TIER_PALETTE[i]])
    )
  })

  it('gives every row its own id', () => {
    const ids = defaultBoard().tiers.map((tier) => tier.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('fromDetail', () => {
  it('maps the API detail and keys tags by champion', () => {
    const result = fromDetail({
      id: 'list-1',
      title: 'Saved',
      created_at: '2026-01-01',
      tiers: [{ id: 't1', label: 'S', color: '#fff', position: 0, champion_ids: ['hercules'] }],
      tags: [{ champion_id: 'hercules', ...tags({ is_attacker: true }) }],
    })

    expect(result).toEqual(
      board({
        id: 'list-1',
        title: 'Saved',
        tiers: [{ id: 't1', label: 'S', color: '#fff', championIds: ['hercules'] }],
        tags: { hercules: tags({ is_attacker: true }) },
      })
    )
  })
})

describe('toSavePayload', () => {
  it('sends rows in order and tags with their champion id', () => {
    const payload = toSavePayload(board({ tags: { hercules: tags({ signature: 200 }) } }))

    expect(payload).toEqual({
      title: 'My board',
      tiers: [{ label: 'S', color: '#ff7f7f', champion_ids: ['hercules'] }],
      tags: [{ champion_id: 'hercules', ...tags({ signature: 200 }) }],
    })
  })
})

describe('hasAnyTag', () => {
  it.each([
    [{}, false],
    [{ is_awakened: true }, true],
    [{ signature: 20 }, true],
  ])('%j → %s', (overrides, expected) => {
    expect(hasAnyTag(tags(overrides))).toBe(expected)
  })
})

describe('rankedIds and tagsOf', () => {
  const ranked = board({
    tiers: [
      { id: 'a', label: 'S', color: '#fff', championIds: ['hercules', 'thor'] },
      { id: 'b', label: 'A', color: '#fff', championIds: ['loki'] },
    ],
    tags: { thor: tags({ is_defender: true }) },
  })

  it('collects every champion placed in a row', () => {
    expect(rankedIds(ranked)).toEqual(new Set(['hercules', 'thor', 'loki']))
  })

  it.each([
    ['thor', tags({ is_defender: true })],
    ['loki', NO_TAGS],
  ])('returns the tags of %s', (championId, expected) => {
    expect(tagsOf(ranked, championId)).toEqual(expected)
  })
})

describe('stored board', () => {
  it('round-trips through localStorage', () => {
    stubLocalStorage()
    storeBoard(board())

    expect(loadStoredBoard(KNOWN)).toEqual(board())
  })

  it('is gone once forgotten', () => {
    stubLocalStorage()
    storeBoard(board())
    forgetStoredBoard()

    expect(loadStoredBoard(KNOWN)).toBeNull()
  })

  it.each([
    ['corrupted JSON', '{not json'],
    ['a value that is not a board', '42'],
  ])('loads as nothing from %s', (_, value) => {
    stubLocalStorage().set('mawster-tierlist:board', value)

    expect(loadStoredBoard(KNOWN)).toBeNull()
  })

  it('behaves as empty when storage is blocked', () => {
    stubLocalStorage({ throwing: true })

    expect(() => storeBoard(board())).not.toThrow()
    expect(() => forgetStoredBoard()).not.toThrow()
    expect(readStored('board')).toBeNull()
  })
})
