import { describe, expect, it } from 'vitest'
import { scoreClass } from '@/app/game/knowledge-base/_components/grid-score'
import {
  buildKnowledgeBaseColumns,
  type KnowledgeBaseColumnLabels,
} from '@/app/game/knowledge-base/_components/knowledge-base-columns'

describe('scoreClass', () => {
  it.each([
    [null, 'bg-muted text-foreground'],
    [1, 'bg-muted text-foreground'],
    [2, 'bg-orange-500 text-white'],
    [3, 'bg-green-500 text-white'],
    [4, 'bg-green-700 text-white'],
    [5, 'bg-green-700 text-white'],
  ])('score %s → %s', (score, expected) => {
    expect(scoreClass(score)).toBe(expected)
  })
})

describe('buildKnowledgeBaseColumns', () => {
  const ids = [
    'player',
    'attacker',
    'defender',
    'node',
    'synergies',
    'prefights',
    'boosts',
    'ko',
    'alliance',
    'season',
    'tier',
    'date',
    'note',
  ] as const
  const labels = Object.fromEntries(
    ids.map((id) => [id, `label-${id}`])
  ) as unknown as KnowledgeBaseColumnLabels

  it('lists every column in display order with its label', () => {
    const columns = buildKnowledgeBaseColumns(labels, false)

    expect(columns.map(({ id, label }) => [id, label])).toEqual(
      ids.map((id) => [id, `label-${id}`])
    )
  })

  it('cuts the export at the season, keeping the same order', () => {
    const columns = buildKnowledgeBaseColumns(labels, true)

    expect(columns.map(({ id }) => id)).toEqual(ids.slice(0, ids.indexOf('season') + 1))
  })

  it('lets only the note column stretch', () => {
    const growing = buildKnowledgeBaseColumns(labels, false).filter((column) => column.grow)

    expect(growing.map(({ id }) => id)).toEqual(['note'])
  })
})
