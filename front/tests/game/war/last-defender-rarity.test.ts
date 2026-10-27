import { describe, expect, it } from 'vitest'
import { parseDefenderRarity } from '@/app/game/war/_components/use-last-defender-rarity'

describe('parseDefenderRarity', () => {
  it.each([
    ['stored value kept', { stars: 6, rank: 5, ascension: 2 }, { stars: 6, rank: 5, ascension: 2 }],
    [
      'unknown rarity → default rarity',
      { stars: 7, rank: 9, ascension: 1 },
      { stars: 7, rank: 3, ascension: 1 },
    ],
    [
      'bad ascension → A0',
      { stars: 7, rank: 5, ascension: 3 },
      { stars: 7, rank: 5, ascension: 0 },
    ],
    ['missing fields → default', {}, { stars: 7, rank: 3, ascension: 0 }],
    ['null → default', null, { stars: 7, rank: 3, ascension: 0 }],
    ['not an object → default', '7r5', { stars: 7, rank: 3, ascension: 0 }],
  ])('%s', (_label, raw, expected) => {
    expect(parseDefenderRarity(raw)).toEqual(expected)
  })
})
