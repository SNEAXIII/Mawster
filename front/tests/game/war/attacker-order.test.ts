import { describe, expect, it } from 'vitest'
import { compareAttackers } from '@/app/game/war/_components/attacker-order'

describe('compareAttackers', () => {
  it('puts preferred first, detested last, then rarity descending', () => {
    const list = [
      { id: 'det-high', attack_preference: 'detested', rarity: '7r6' },
      { id: 'neu-low', attack_preference: 'neutral', rarity: '6r4' },
      { id: 'pref-low', attack_preference: 'preferred', rarity: '6r4' },
      { id: 'neu-high', attack_preference: 'neutral', rarity: '7r3' },
      { id: 'pref-high', attack_preference: 'preferred', rarity: '7r1' },
    ] as const
    expect([...list].sort(compareAttackers).map((a) => a.id)).toEqual([
      'pref-high',
      'pref-low',
      'neu-high',
      'neu-low',
      'det-high',
    ])
  })
})
