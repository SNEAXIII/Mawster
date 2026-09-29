import { api, jsonBody } from '@/app/services/utils'
import type { SeasonFormat } from '@/app/services/season'

// ─── Defense Placement Service ───────────────────────────

export interface DefensePlacement {
  id: string
  alliance_id: string
  battlegroup: number
  node_number: number
  champion_user_id: string
  game_account_id: string
  game_pseudo: string
  champion_name: string
  champion_alias: string | null
  champion_class: string
  champion_image_url: string | null
  rarity: string
  signature: number
  is_preferred_attacker: boolean
  ascension: number
  is_saga_attacker: boolean
  is_saga_defender: boolean
  placed_by_id: string | null
  placed_by_pseudo: string | null
  created_at: string
}

export interface ChampionOwner {
  champion_user_id: string
  game_account_id: string
  game_pseudo: string
  rarity: string
  stars: number
  rank: number
  signature: number
  defender_count: number
  is_preferred_attacker: boolean
  ascension: number
}

export interface AvailableChampion {
  champion_id: string
  champion_name: string
  champion_alias: string | null
  champion_class: string
  image_url: string | null
  is_saga_attacker: boolean
  is_saga_defender: boolean
  owners: ChampionOwner[]
}

export interface BgMember {
  game_account_id: string
  game_pseudo: string
  defender_count: number
  max_defenders: number
  is_owner: boolean
  is_officer: boolean
  is_strategist: boolean
}

export type PlanState = 'incomplete' | 'validated'

export interface Quota {
  used: number
  limit: number
}

export interface DefensePlanNode {
  id: string
  battlegroup: number
  node_number: number
  champion_id: string
  champion_name: string
  champion_alias: string | null
  champion_class: string
  champion_image_url: string | null
  champion_user_id: string | null
  game_account_id: string | null
  game_pseudo: string | null
  rarity: string | null
  signature: number
  is_preferred_attacker: boolean
  ascension: number
  is_saga_attacker: boolean
  is_saga_defender: boolean
  placed_by_id: string | null
  placed_by_pseudo: string | null
}

export interface DefensePlanSummary {
  id: string
  name: string
  battlegroup: number
  format: SeasonFormat
  state: PlanState
  is_active: boolean
  created_at: string
}

export interface DefensePlan extends DefensePlanSummary {
  node_count: number
  nodes: DefensePlanNode[]
}

export interface DefensePlanList {
  plans: DefensePlanSummary[]
  quota: Quota
}

export interface ActivePlan {
  battlegroup: number
  format: SeasonFormat
  plan: DefensePlan | null
}

export interface CreatePlanBody {
  name: string
  format: SeasonFormat
  template_id?: string
  source_plan_id?: string
}

// ─── Defense API ─────────────────────────────────────────

export const defenseRequest = <T>(path: string, fallback: string, init?: RequestInit) =>
  api<T>(`/alliances/${path}`, fallback, init)

const plan = (allianceId: string, planId: string) => `${allianceId}/defense/plans/${planId}`
const bgPath = (allianceId: string, bg: number) => `${allianceId}/defense/bg/${bg}`

export const getActivePlan = (allianceId: string, bg: number) =>
  defenseRequest<ActivePlan>(`${bgPath(allianceId, bg)}/active`, 'Failed to load defense')

export const getBgMembers = (allianceId: string, bg: number) =>
  defenseRequest<BgMember[]>(`${bgPath(allianceId, bg)}/members`, 'Failed to load BG members')

export const listPlans = (allianceId: string, bg: number, format: SeasonFormat) =>
  defenseRequest<DefensePlanList>(
    `${bgPath(allianceId, bg)}/plans?format=${format}`,
    'Failed to load plans'
  )

export const createPlan = (allianceId: string, bg: number, body: CreatePlanBody) =>
  defenseRequest<DefensePlan>(
    `${bgPath(allianceId, bg)}/plans`,
    'Failed to create plan',
    jsonBody('POST', body)
  )

export const getPlan = (allianceId: string, planId: string) =>
  defenseRequest<DefensePlan>(plan(allianceId, planId), 'Failed to load plan')

export const renamePlan = (allianceId: string, planId: string, name: string) =>
  defenseRequest<DefensePlan>(
    plan(allianceId, planId),
    'Failed to rename plan',
    jsonBody('PATCH', { name })
  )

export const deletePlan = (allianceId: string, planId: string) =>
  defenseRequest<void>(plan(allianceId, planId), 'Failed to delete plan', jsonBody('DELETE'))

export const activatePlan = (allianceId: string, planId: string) =>
  defenseRequest<DefensePlan>(
    `${plan(allianceId, planId)}/activate`,
    'Failed to activate plan',
    jsonBody('POST', {})
  )

export const savePlanAsTemplate = (allianceId: string, planId: string, name: string) =>
  defenseRequest<{ id: string }>(
    `${plan(allianceId, planId)}/template`,
    'Failed to save template',
    jsonBody('POST', { name })
  )

export const setPlanNode = (
  allianceId: string,
  planId: string,
  node: number,
  championUserId: string
) =>
  defenseRequest<DefensePlan>(
    `${plan(allianceId, planId)}/nodes/${node}`,
    'Failed to place defender',
    jsonBody('PUT', { champion_user_id: championUserId })
  )

export const removePlanNode = (allianceId: string, planId: string, node: number) =>
  defenseRequest<void>(
    `${plan(allianceId, planId)}/nodes/${node}`,
    'Failed to remove defender',
    jsonBody('DELETE')
  )

export const clearPlan = (allianceId: string, planId: string) =>
  defenseRequest<void>(
    `${plan(allianceId, planId)}/nodes`,
    'Failed to clear defense',
    jsonBody('DELETE')
  )

export const getPlanAvailableChampions = (allianceId: string, planId: string, node: number) =>
  defenseRequest<AvailableChampion[]>(
    `${plan(allianceId, planId)}/available-champions?node_number=${node}`,
    'Failed to load available champions'
  )

export const getPlanMembers = (allianceId: string, planId: string) =>
  defenseRequest<BgMember[]>(`${plan(allianceId, planId)}/members`, 'Failed to load BG members')
