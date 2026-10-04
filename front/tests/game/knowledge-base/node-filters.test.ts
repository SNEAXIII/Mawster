import { describe, expect, it } from 'vitest'
import {
  nodesForPath,
  PATHS,
  pathsAvailable,
  visibleNodes,
} from '@/app/game/knowledge-base/_components/node-filters'

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('pathsAvailable', () => {
  it.each([
    [null, true],
    [1, true],
    [2, true],
    [3, false],
    [4, false],
  ])('tier %s → %s', (section, expected) => {
    expect(pathsAvailable(section)).toBe(expected)
  })
})

describe('nodesForPath', () => {
  it.each([
    [1, [1, 10, 19, 28]],
    [9, [9, 18, 27, 36]],
  ])('path %i runs through %j', (path, expected) => {
    expect(nodesForPath(path)).toEqual(expected)
  })

  it('splits the nodes of tiers 1 and 2 across the paths, each once', () => {
    const nodes = PATHS.flatMap(nodesForPath).toSorted((a, b) => a - b)

    expect(nodes).toEqual(range(1, 36))
  })
})

describe('visibleNodes', () => {
  it.each([
    [null, null, range(1, 50)],
    [1, null, range(1, 18)],
    [2, null, range(19, 36)],
    [null, 3, [3, 12, 21, 30]],
    [1, 3, [3, 12]],
    [2, 3, [21, 30]],
  ])('tier %s, path %s → %j', (section, path, expected) => {
    expect(visibleNodes(section, path)).toEqual(expected)
  })
})
