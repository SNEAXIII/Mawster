import { describe, expect, it } from 'vitest'
import { defaultBoard, rankedIds, tagsOf, TIER_PALETTE } from '@/app/tools/_lib/board'
import { hasAnyTag, NO_TAGS } from '@/app/tools/_lib/types'
import { board, tags } from './fixtures'

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
