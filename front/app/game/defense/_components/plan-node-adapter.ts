import type { DefensePlacement, DefensePlanNode } from '@/app/services/defense'
import type { DefenseTemplateNode } from '@/app/services/defense-templates'

/** champion_id rides along (outside the shared interface) so a Champion-only node can
 *  filter the selector down to its own species when a Player still needs picking. */
export function planNodeToPlacement(
  node: DefensePlanNode,
  allianceId: string
): DefensePlacement & { champion_id: string } {
  return {
    ...node,
    alliance_id: allianceId,
    champion_user_id: node.champion_user_id ?? '',
    game_account_id: node.game_account_id ?? '',
    game_pseudo: node.game_pseudo ?? '',
    rarity: node.rarity ?? '',
    created_at: '',
  }
}

export function templateNodeToPlacement(
  node: DefenseTemplateNode,
  battlegroup: number
): DefensePlacement & { champion_id: string } {
  return {
    ...node,
    id: `${node.node_number}`,
    alliance_id: '',
    battlegroup,
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
  }
}
