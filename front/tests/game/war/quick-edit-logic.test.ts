import { describe, expect, it } from 'vitest'
import {
  clamp,
  createDefenderTracker,
  createNodeChain,
  FULL_RANK_RANGE,
  keepNodes,
  parseRangeWithin,
  sliceNodes,
  widen,
} from '@/app/game/war/_components/quick-edit/quick-edit-logic'
import { rarityIndex } from '@/app/services/roster'

describe('sliceNodes', () => {
  it.each([
    ['regular map, every slice', 50, [0, 4], 1, 50, 50],
    ['regular map, slices of 10', 50, [1, 2], 11, 30, 20],
    ['Big Thing, slices of 2', 10, [0, 0], 1, 2, 2],
    ['Big Thing, last slice', 10, [4, 4], 9, 10, 2],
  ] as const)('%s', (_label, nodeCount, range, first, last, length) => {
    const nodes = sliceNodes(nodeCount, [range[0], range[1]])
    expect([nodes[0], nodes.at(-1), nodes.length]).toEqual([first, last, length])
  })
})

describe('parseRangeWithin', () => {
  const parseAsc = parseRangeWithin([0, 2])
  it.each([
    ['stored range kept', [1, 2], [1, 2]],
    ['swapped range ordered', [2, 0], [0, 2]],
    ['out of bounds → full', [0, 3], [0, 2]],
    ['wrong length → full', [1], [0, 2]],
    ['not an array → full', 'A1', [0, 2]],
  ])('%s', (_label, raw, expected) => {
    expect(parseAsc(raw)).toEqual(expected)
  })

  it('falls back to the full rank range, not the selectors default', () => {
    expect(parseRangeWithin(FULL_RANK_RANGE)(['7r1', '7r6'])).toEqual(FULL_RANK_RANGE)
  })
})

describe('createDefenderTracker', () => {
  it('sends no DELETE after a failed save on an empty node', () => {
    const tracker = createDefenderTracker()
    // The save failed: nothing was recorded, the map is empty.
    expect(tracker.holds(11, false)).toBe(false)
  })

  it('sends no DELETE for a re-pick removed before its save, even with a stale map', () => {
    const tracker = createDefenderTracker()
    tracker.placed(11)
    expect(tracker.holds(11, false)).toBe(true)
    tracker.removed(11)
    // The map has not reloaded yet and still shows the first defender.
    expect(tracker.holds(11, true)).toBe(false)
  })

  it('trusts the map for nodes it never wrote, until cleared', () => {
    const tracker = createDefenderTracker()
    expect(tracker.holds(10, true)).toBe(true)
    tracker.removed(10)
    tracker.clear()
    expect(tracker.holds(10, true)).toBe(true)
  })

  it('keeps what it knows of a node still in flight across a clear', () => {
    const tracker = createDefenderTracker()
    tracker.placed(11)
    tracker.placed(12)
    tracker.clear((node) => node === 11)
    expect([tracker.holds(11, false), tracker.holds(12, false)]).toEqual([true, false])
  })
})

describe('createNodeChain', () => {
  it('starts a removal only once the save in flight has landed', async () => {
    const chain = createNodeChain()
    const order: string[] = []
    let land!: () => void
    const put = chain.run(11, () =>
      new Promise<void>((res) => (land = res)).then(() => void order.push('PUT'))
    )
    const del = chain.run(11, async () => void order.push('DELETE'))
    await Promise.resolve()
    expect([order, chain.busy(11)]).toEqual([[], true])
    land()
    await Promise.all([put, del])
    expect(order).toEqual(['PUT', 'DELETE'])
  })

  it('runs the next write after a failure and frees the node once idle', async () => {
    const chain = createNodeChain()
    await chain.run(11, () => Promise.reject(new Error('409')))
    await expect(chain.run(11, async () => {})).resolves.toBeUndefined()
    await Promise.resolve()
    expect([chain.busy(11), chain.busy(12)]).toEqual([false, false])
  })
})

describe('keepNodes', () => {
  it('keeps only the nodes asked for', () => {
    expect(keepNodes({ 10: 'saved', 11: 'saving' }, (node) => node === 11)).toEqual({
      11: 'saving',
    })
  })
})

describe('row bounds', () => {
  it('clamps a new value into the header range', () => {
    expect(clamp(7, [2, 5])).toBe(5)
    expect(clamp(0, [2, 5])).toBe(2)
  })

  it('widens the header range to keep a saved value reachable', () => {
    expect(widen([2, 5], 7)).toEqual([2, 7])
    expect(widen([2, 5], 0)).toEqual([0, 5])
    expect(widen([2, 5], 3)).toEqual([2, 5])
  })

  it('maps a placement rarity to its RARITIES index', () => {
    expect(rarityIndex('6r4')).toBe(0)
    expect(rarityIndex('7r3')).toBe(4)
  })
})
