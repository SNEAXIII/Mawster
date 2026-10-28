import { describe, expect, it } from 'vitest'
import { parseRankRange, rarityWeight } from '@/app/game/_components/use-rarity-filter'
import {
  cleanAllianceName,
  cleanAllianceTag,
} from '@/app/game/alliances/_viewmodels/use-alliance-actions'
import { attributeCy, requiresSeason } from '@/app/admin/_viewmodels/champion-attributes'

describe('rarityWeight', () => {
  it('orders stars before ranks', () => {
    expect(rarityWeight('7r6')).toBe(706)
    expect(rarityWeight('7r1')).toBeGreaterThan(rarityWeight('6r5'))
  })
})

describe('parseRankRange', () => {
  // Indexes into RARITIES: 6r4=0, 6r5=1, 7r1=2 … 7r6=7.
  it.each([
    ['legacy tiers → min..max', ['7r3', '6r5', '7r1'], [1, 4]],
    ['legacy unknown tiers dropped', ['9r9', '7r2', 'x'], [3, 3]],
    ['current [lo, hi] kept', [2, 6], [2, 6]],
    ['swapped [hi, lo] ordered', [6, 2], [2, 6]],
    ['empty array → default', [], [2, 7]],
    ['only unknown tiers → default', ['9r9'], [2, 7]],
    ['out-of-range indexes → default', [-1, 12], [2, 7]],
    ['not an array → default', { lo: 1 }, [2, 7]],
    ['null → default', null, [2, 7]],
  ])('%s', (_label, raw, expected) => {
    expect(parseRankRange(raw)).toEqual(expected)
  })
})

describe('alliance name and tag cleaning', () => {
  it('strips emoji and control characters, keeps accents and spaces', () => {
    expect(cleanAllianceName('Les 😀Héros\u0007')).toBe('Les Héros')
  })

  it('clips the name at 25 code points', () => {
    expect([...cleanAllianceName('é'.repeat(30))]).toHaveLength(25)
  })

  it('uppercases and clips the tag at 5', () => {
    expect(cleanAllianceTag('ab😀cdefg')).toBe('ABCDE')
  })
})

describe('champion attributes', () => {
  it.each([
    ['sagaAttacker', 'saga-attacker'],
    ['is7StarsAvailable', 'is7-stars-available'],
    ['plain', 'plain'],
  ])('attributeCy(%s) → %s', (name, expected) => {
    expect(attributeCy(name)).toBe(expected)
  })

  it('only saga roles depend on a season', () => {
    expect(requiresSeason('is_saga_attacker')).toBe(true)
    expect(requiresSeason('is_saga_defender')).toBe(true)
    expect(requiresSeason('has_prefight')).toBe(false)
  })
})
