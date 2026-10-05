import { describe, expect, it } from 'vitest'
import {
  planNodeToPlacement,
  templateNodeToPlacement,
} from '@/app/game/defense/_components/plan-node-adapter'
import type { DefensePlanNode } from '@/app/services/defense'
import type { DefenseTemplateNode } from '@/app/services/defense-templates'

const templateNode: DefenseTemplateNode = {
  node_number: 42,
  champion_id: 'champ-1',
  champion_name: 'Hercules',
  champion_alias: null,
  champion_class: 'Cosmic',
  champion_image_url: null,
}

const assignedNode: DefensePlanNode = {
  ...templateNode,
  id: 'node-1',
  battlegroup: 2,
  champion_user_id: 'cu-1',
  game_account_id: 'ga-1',
  game_pseudo: 'Pseudo',
  rarity: '7r5',
  signature: 200,
  is_preferred_attacker: true,
  ascension: 1,
  is_saga_attacker: false,
  is_saga_defender: true,
  placed_by_id: 'user-1',
  placed_by_pseudo: 'Officer',
}

describe('planNodeToPlacement', () => {
  it('keeps an assigned node and stamps the alliance', () => {
    expect(planNodeToPlacement(assignedNode, 'alliance-1')).toEqual({
      ...assignedNode,
      alliance_id: 'alliance-1',
      created_at: '',
    })
  })

  it('blanks the player fields of a champion-only node', () => {
    const championOnly: DefensePlanNode = {
      ...assignedNode,
      champion_user_id: null,
      game_account_id: null,
      game_pseudo: null,
      rarity: null,
    }

    expect(planNodeToPlacement(championOnly, 'alliance-1')).toMatchObject({
      champion_id: 'champ-1',
      champion_user_id: '',
      game_account_id: '',
      game_pseudo: '',
      rarity: '',
    })
  })
})

describe('templateNodeToPlacement', () => {
  it('builds an unassigned placement keyed by node number', () => {
    expect(templateNodeToPlacement(templateNode, 3)).toEqual({
      ...templateNode,
      id: '42',
      alliance_id: '',
      battlegroup: 3,
      champion_user_id: '',
      game_account_id: '',
      game_pseudo: '',
      rarity: '',
      signature: 0,
      is_preferred_attacker: false,
      ascension: 0,
      is_saga_attacker: false,
      is_saga_defender: false,
      placed_by_id: null,
      placed_by_pseudo: null,
      created_at: '',
    })
  })
})
