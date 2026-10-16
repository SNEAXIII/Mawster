import { describe, expect, it } from 'vitest'
import { catalogCandidates } from '@/app/game/war/_components/use-catalog-picks'
import { keepBestCopy } from '@/app/game/war/_components/use-available-attackers'
import { providerOf, slotKey, type AvailableAttacker } from '@/app/services/war'
import type { CatalogChampion } from '@/app/services/tierlist'

const champion = (id: string): CatalogChampion => ({
  id,
  name: id,
  champion_class: 'Mystic',
  image_url: null,
  alias: null,
  is_7_stars_available: true,
  is_ascendable: true,
  has_prefight: true,
  is_saga_attacker: false,
  is_saga_defender: false,
})

const copy = (over: Partial<AvailableAttacker>): AvailableAttacker => ({
  champion_user_id: 'cu',
  game_account_id: 'acc',
  game_pseudo: 'Bob',
  champion_id: 'storm',
  champion_name: 'Storm',
  champion_alias: null,
  image_url: null,
  is_preferred_attacker: false,
  is_saga_attacker: false,
  is_saga_defender: false,
  is_on_defense: false,
  champion_class: 'Mutant',
  rarity: '7r1',
  ascension: 0,
  signature: 0,
  ...over,
})

describe('catalogCandidates', () => {
  const bob = { id: 'acc', pseudo: 'Bob' }

  it('leaves out what the player owns, defenders included, and bans', () => {
    const owned = [copy({ champion_id: 'storm', is_on_defense: true })]
    const picks = catalogCandidates(
      [champion('storm'), champion('magik'), champion('hulk')],
      owned,
      new Set(['hulk']),
      bob
    )
    expect(picks.map((p) => p.champion_id)).toEqual(['magik'])
    expect(picks[0]).toMatchObject({ game_account_id: 'acc', game_pseudo: 'Bob' })
  })

  it("ignores another player's copies", () => {
    const owned = [copy({ champion_id: 'storm', game_account_id: 'other' })]
    expect(catalogCandidates([champion('storm')], owned, new Set(), bob)).toHaveLength(1)
  })
})

describe('providerOf', () => {
  it('sends a defender as an unrecorded copy', () => {
    expect(providerOf(copy({ is_on_defense: true }))).toEqual({
      champion_id: 'storm',
      game_account_id: 'acc',
    })
  })

  it('sends a free copy by its roster entry', () => {
    expect(providerOf(copy({}))).toEqual({ champion_user_id: 'cu' })
  })
})

describe('slotKey', () => {
  it('keys an unrecorded copy by its champion, a recorded one by its entry', () => {
    expect(slotKey({ champion_user_id: null, champion_id: 'storm' })).toBe('storm')
    expect(slotKey({ champion_user_id: 'cu', champion_id: 'storm' })).toBe('cu')
  })
})

describe('keepBestCopy', () => {
  it('prefers a free copy over a stronger defender', () => {
    const defender = copy({ champion_user_id: 'def', rarity: '7r5', is_on_defense: true })
    const free = copy({ champion_user_id: 'free', rarity: '6r5' })
    expect(keepBestCopy([defender, free]).map((a) => a.champion_user_id)).toEqual(['free'])
  })
})
