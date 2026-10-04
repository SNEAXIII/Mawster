import { describe, expect, it } from 'vitest'
import {
  buildCopyName,
  memberRoleOrder,
  NAME_MAX_LENGTH,
  parseRarity,
  rarityBadgeClass,
  rarityLabel,
} from '@/app/game/defense/_components/defense-utils'
import type { BgMember } from '@/app/services/defense'

describe('parseRarity', () => {
  it.each([
    ['7r4', { stars: 7, rank: 4 }],
    ['6R5', { stars: 6, rank: 5 }],
    ['garbage', { stars: 0, rank: 0 }],
    ['', { stars: 0, rank: 0 }],
  ])('parses %j', (rarity, expected) => {
    expect(parseRarity(rarity)).toEqual(expected)
  })
})

describe('rarityBadgeClass', () => {
  it.each([
    ['7r6', 'text-yellow-400'],
    ['7r5', 'text-blue-400'],
    ['7r4', 'text-green-400'],
    ['7r3', 'text-red-400'],
    ['6r5', 'text-red-400'],
    ['garbage', 'text-red-400'],
  ])('colours %s as %s', (rarity, expected) => {
    expect(rarityBadgeClass(rarity)).toBe(expected)
  })
})

describe('rarityLabel', () => {
  it.each([
    ['7r4', 200, undefined, 'R4·200'],
    ['7r4', 200, 0, 'R4·200'],
    ['7r5', 20, 1, 'R5·20·A1'],
    ['garbage', 200, 2, 'R0·200·A2'],
  ])('labels %s sig %i ascension %s as %s', (rarity, signature, ascension, expected) => {
    expect(rarityLabel(rarity, signature, ascension)).toBe(expected)
  })
})

describe('memberRoleOrder', () => {
  const member = (roles: Partial<BgMember>): BgMember => ({
    game_account_id: 'ga-1',
    game_pseudo: 'Pseudo',
    defender_count: 0,
    max_defenders: 5,
    is_owner: false,
    is_officer: false,
    is_strategist: false,
    ...roles,
  })

  it.each([
    ['owner', { is_owner: true, is_officer: true, is_strategist: true }, 0],
    ['officer', { is_officer: true, is_strategist: true }, 1],
    ['strategist', { is_strategist: true }, 2],
    ['member', {}, 3],
  ])('ranks %s as %i, highest role first', (_, roles, expected) => {
    expect(memberRoleOrder(member(roles))).toBe(expected)
  })
})

describe('buildCopyName', () => {
  const template = '{name} (copy)'
  const decorationLength = template.length - '{name}'.length

  it('keeps a short name whole', () => {
    expect(buildCopyName(template, 'Plan A')).toBe('Plan A (copy)')
  })

  it('truncates a long name so the result fits the limit', () => {
    const result = buildCopyName(template, 'x'.repeat(NAME_MAX_LENGTH))

    expect(result).toHaveLength(NAME_MAX_LENGTH)
    expect(result).toBe(`${'x'.repeat(NAME_MAX_LENGTH - decorationLength)} (copy)`)
  })

  it('drops the name when the decoration alone exceeds the limit', () => {
    const longTemplate = `{name}${'!'.repeat(NAME_MAX_LENGTH + 1)}`

    expect(buildCopyName(longTemplate, 'Plan A')).toBe('!'.repeat(NAME_MAX_LENGTH + 1))
  })
})
