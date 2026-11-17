import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RANK_THRESHOLD,
  formatNodeNumbers,
  parseAscensionThreshold,
  parseRankThreshold,
  rankThresholdReport,
} from '@/app/game/defense/_components/rank-threshold'
import type { DefensePlacement } from '@/app/services/defense'
import { MAX_ASCENSION, RARITIES } from '@/app/services/roster'

const R7R5 = RARITIES.indexOf('7r5')

function placement(node: number, overrides: Partial<DefensePlacement> = {}): DefensePlacement {
  return {
    id: `p-${node}`,
    alliance_id: 'a-1',
    battlegroup: 1,
    node_number: node,
    champion_user_id: `cu-${node}`,
    game_account_id: 'ga-1',
    game_pseudo: 'Player',
    champion_name: 'Hercules',
    champion_alias: null,
    champion_class: 'Cosmic',
    champion_image_url: null,
    rarity: '7r5',
    signature: 0,
    attack_preference: 'neutral',
    ascension: 0,
    is_ascendable: true,
    is_saga_attacker: false,
    is_saga_defender: false,
    placed_by_id: null,
    placed_by_pseudo: null,
    created_at: '',
    ...overrides,
  }
}

describe('rankThresholdReport', () => {
  it('counts a copy below the rank threshold', () => {
    const report = rankThresholdReport([placement(1, { rarity: '7r4' })], [1], R7R5, 0)
    expect(report.counts).toEqual({ belowRank: 1, belowAscension: 0, unfilled: 0 })
    expect([...report.highlighted]).toEqual([1])
  })

  it('counts a 6-star copy below the lowest threshold', () => {
    const report = rankThresholdReport(
      [placement(1, { rarity: '6r5' })],
      [1],
      RARITIES.indexOf('7r1'),
      0
    )
    expect(report.counts.belowRank).toBe(1)
  })

  it('reads an uppercase rarity', () => {
    const report = rankThresholdReport([placement(1, { rarity: '7R4' })], [1], R7R5, 0)
    expect(report.counts.belowRank).toBe(1)
  })

  it('leaves a copy at the threshold alone', () => {
    const report = rankThresholdReport([placement(1)], [1], R7R5, 0)
    expect(report.counts).toEqual({ belowRank: 0, belowAscension: 0, unfilled: 0 })
    expect(report.highlighted.size).toBe(0)
  })

  it('counts an ascendable copy below the ascension threshold', () => {
    const report = rankThresholdReport([placement(1, { ascension: 1 })], [1], R7R5, 2)
    expect(report.counts).toEqual({ belowRank: 0, belowAscension: 1, unfilled: 0 })
  })

  it('never counts a non-ascendable Champion for ascension', () => {
    const report = rankThresholdReport([placement(1, { is_ascendable: false })], [1], R7R5, 2)
    expect(report.counts.belowAscension).toBe(0)
    expect(report.highlighted.size).toBe(0)
  })

  it('counts nothing for ascension at threshold 0', () => {
    const report = rankThresholdReport([placement(1)], [1], R7R5, 0)
    expect(report.counts.belowAscension).toBe(0)
  })

  it('counts an empty node and a Champion with no Player as unfilled, nothing else', () => {
    const championOnly = placement(2, { champion_user_id: '', rarity: '', ascension: 0 })
    const report = rankThresholdReport([championOnly], [1, 2], R7R5, 2)
    expect(report.counts).toEqual({ belowRank: 0, belowAscension: 0, unfilled: 2 })
    expect([...report.highlighted].sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('counts a node under both causes it meets', () => {
    const both = placement(1, { rarity: '7r3', ascension: 0 })
    const report = rankThresholdReport([both], [1], R7R5, 1)
    expect(report.counts).toEqual({ belowRank: 1, belowAscension: 1, unfilled: 0 })
    expect(report.highlighted.size).toBe(1)
  })
})

describe('formatNodeNumbers', () => {
  it('lists every node of the format without placeholders', () => {
    expect(formatNodeNumbers('regular')).toHaveLength(50)
    expect(formatNodeNumbers('regular')).not.toContain(0)
  })
})

describe('threshold parsing', () => {
  it('keeps an in-range stored value', () => {
    expect(parseRankThreshold(RARITIES.indexOf('7r2'))).toBe(RARITIES.indexOf('7r2'))
    expect(parseAscensionThreshold(1)).toBe(1)
  })

  it('falls back to the defaults on an out-of-range value', () => {
    expect(parseRankThreshold(RARITIES.indexOf('6r5'))).toBe(DEFAULT_RANK_THRESHOLD)
    expect(parseRankThreshold(RARITIES.length)).toBe(DEFAULT_RANK_THRESHOLD)
    expect(parseRankThreshold('7r5')).toBe(DEFAULT_RANK_THRESHOLD)
    expect(parseAscensionThreshold(MAX_ASCENSION + 1)).toBe(0)
    expect(parseAscensionThreshold(-1)).toBe(0)
  })
})
