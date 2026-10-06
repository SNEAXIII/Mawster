import { api, jsonBody } from '@/app/services/utils'
import type { SeasonFormat } from '@/app/services/season'

// ─── War Service ─────────────────────────────────────────

// Mirrors the KoCount bound in api/src/game_types.py; a War narrows it via `max_ko_count`.
export const MAX_KO_COUNT = 10

export interface BannedChampion {
  id: string
  name: string
  champion_class: string
  image_url: string | null
  rarity: string | null
  alias: string | null
  is_saga_attacker: boolean
  is_saga_defender: boolean
}

export interface War {
  id: string
  alliance_id: string
  opponent_name: string
  status: 'active' | 'ended'
  created_by_pseudo: string
  created_at: string
  banned_champions: BannedChampion[]
  season_id: string | null
  season_number: number | null
  win: boolean | null
  opponent_deaths: number | null
  elo_change: number | null
  tier: number | null
  is_map_correctable: boolean
  format: SeasonFormat
  node_count: number
  max_attackers_per_member: number
  max_ko_count: number
}

// The three are mutually exclusive in-game, hence one slot rather than three flags.
export type WarBoost = 'power_start' | 'invulnerability' | 'regeneration'

export interface WarBoosts {
  war_boost: WarBoost | null
  has_defense_boost: boolean
  has_power_boost: boolean
  has_specials_boost: boolean
}

export interface WarPlacement {
  id: string
  war_id: string
  battlegroup: number
  node_number: number
  champion_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
  rarity: string
  ascension: number
  placed_by_pseudo: string | null
  created_at: string
  ko_count: number
  is_combat_completed: boolean
  is_fight_not_done: boolean
  is_planning_error: boolean
  war_boost: WarBoost | null
  has_defense_boost: boolean
  has_power_boost: boolean
  has_specials_boost: boolean
  attacker_champion_user_id: string | null
  attacker_game_account_id: string | null
  attacker_pseudo: string | null
  attacker_champion_name: string | null
  attacker_champion_class: string | null
  attacker_image_url: string | null
  attacker_rarity: string | null
  attacker_is_preferred_attacker: boolean | null
  is_saga_attacker: boolean
  is_saga_defender: boolean
  attacker_ascension: number | null
  attacker_is_saga_attacker: boolean | null
  attacker_is_saga_defender: boolean | null
  is_assisted: boolean
  assistor_champion_user_id: string | null
  assistor_game_account_id: string | null
  assistor_pseudo: string | null
  assistor_champion_name: string | null
  assistor_champion_class: string | null
  assistor_image_url: string | null
  assistor_rarity: string | null
  assistor_ascension: number | null
  note?: string | null
  note_id?: string | null
  note_blocked?: boolean
  is_attacker_locked: boolean
}

export interface WarBgProgress {
  battlegroup: number
  completed: number
  total: number
  ko_count: number
}

export interface WarProgress {
  completed: number
  total: number
  ko_count: number
  battlegroups: WarBgProgress[]
}

export interface WarDefenseSummary {
  war_id: string
  battlegroup: number
  placements: WarPlacement[]
  progress: WarProgress | null
}

export interface AvailableAttacker {
  champion_user_id: string
  game_account_id: string
  game_pseudo: string
  champion_id: string
  champion_name: string
  champion_alias: string | null
  champion_class: string
  image_url: string | null
  rarity: string
  ascension: number
  signature: number
  is_preferred_attacker: boolean
  is_saga_attacker: boolean
  is_saga_defender: boolean
}

export interface WarSynergy {
  id: string
  war_id: string
  battlegroup: number
  game_account_id: string
  champion_user_id: string
  target_champion_user_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
  rarity: string
  ascension: number
  is_saga_attacker: boolean
  is_saga_defender: boolean
  target_champion_name: string
  game_pseudo: string
  created_at: string
}

export interface WarPrefight {
  id: string
  war_id: string
  battlegroup: number
  game_account_id: string
  champion_user_id: string
  target_node_number: number
  champion_name: string
  champion_class: string
  image_url: string | null
  rarity: string
  ascension: number
  is_saga_attacker: boolean
  is_saga_defender: boolean
  game_pseudo: string
  created_at: string
}

// ─── War API ─────────────────────────────────────────────

export async function getWars(allianceId: string): Promise<War[]> {
  return api(`/alliances/${allianceId}/wars`, 'Failed to load wars')
}

export async function getCurrentWar(allianceId: string): Promise<War> {
  return api(`/alliances/${allianceId}/wars/current`, 'Failed to load current war')
}

export async function createWar(
  allianceId: string,
  opponentName: string,
  bannedChampionIds: string[] = []
): Promise<War> {
  return api(
    `/alliances/${allianceId}/wars`,
    'Failed to create war',
    jsonBody('POST', { opponent_name: opponentName, banned_champion_ids: bannedChampionIds })
  )
}

export async function updateWar(
  allianceId: string,
  warId: string,
  opponentName: string,
  bannedChampionIds: string[] = []
): Promise<War> {
  return api(
    `/alliances/${allianceId}/wars/${warId}`,
    'Failed to update war',
    jsonBody('PATCH', { opponent_name: opponentName, banned_champion_ids: bannedChampionIds })
  )
}

export async function getWarDefense(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<WarDefenseSummary> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}`,
    'Failed to load war defense'
  )
}

export interface WarPlacementCreateRequest {
  node_number: number
  champion_id: string
  stars: number
  rank: number
  ascension: number
}

export async function placeWarDefender(
  allianceId: string,
  warId: string,
  battlegroup: number,
  request: WarPlacementCreateRequest
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/place`,
    'Failed to place defender',
    jsonBody('POST', request)
  )
}

export async function removeWarDefender(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<void> {
  await api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}`,
    'Failed to remove defender',
    { method: 'DELETE' }
  )
}

export async function endWar(
  allianceId: string,
  warId: string,
  win: boolean,
  eloChange: number | null,
  opponentDeaths: number | null
): Promise<War> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/end`,
    'Failed to end war',
    jsonBody('POST', { win, elo_change: eloChange, opponent_deaths: opponentDeaths })
  )
}

export async function updateWarOpponentDeaths(
  allianceId: string,
  warId: string,
  opponentDeaths: number | null
): Promise<War> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/opponent-deaths`,
    'Failed to update opponent deaths',
    jsonBody('PATCH', { opponent_deaths: opponentDeaths })
  )
}

export async function clearWarBg(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<void> {
  await api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/clear`,
    'Failed to clear war battlegroup',
    { method: 'DELETE' }
  )
}

// ─── Attacker API ─────────────────────────────────────────

export async function getAvailableAttackers(
  allianceId: string,
  warId: string,
  battlegroup: number,
  targetGameAccountId?: string,
  nodeNumber?: number
): Promise<AvailableAttacker[]> {
  const params = new URLSearchParams()
  if (targetGameAccountId) params.set('attacker_id', targetGameAccountId)
  if (nodeNumber !== undefined) params.set('node_number', String(nodeNumber))
  const suffix = params.toString() ? `?${params}` : ''
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/available-attackers${suffix}`,
    'Failed to load available attackers'
  )
}

export async function assignWarAttacker(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  championUserId: string
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
    'Failed to assign attacker',
    jsonBody('POST', { champion_user_id: championUserId })
  )
}

export async function removeWarAttacker(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
    'Failed to remove attacker',
    { method: 'DELETE' }
  )
}

export async function updateWarBoosts(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  boosts: WarBoosts
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/boosts`,
    'Failed to update boosts',
    jsonBody('PUT', boosts)
  )
}

export async function updateWarKo(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  koCount: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/ko`,
    'Failed to update KO count',
    jsonBody('PATCH', { ko_count: koCount })
  )
}

export async function toggleCombatCompleted(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/complete`,
    'Failed to toggle combat completion',
    { method: 'PATCH' }
  )
}

export async function toggleFightNotDone(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/fight-not-done`,
    'Failed to toggle fight not done',
    { method: 'PATCH' }
  )
}

export async function togglePlanningError(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/planning-error`,
    'Failed to toggle planning error',
    { method: 'PATCH' }
  )
}

// ─── Assist API ───────────────────────────────────────────

export async function assignWarAssist(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  championUserId: string
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/assist`,
    'Failed to assign assist',
    jsonBody('POST', { champion_user_id: championUserId })
  )
}

export async function removeWarAssist(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/assist`,
    'Failed to remove assist',
    { method: 'DELETE' }
  )
}

// ─── Synergy API ──────────────────────────────────────────

export async function getWarSynergies(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<WarSynergy[]> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy`,
    'Failed to load synergy attackers'
  )
}

export async function addWarSynergy(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string,
  targetChampionUserId: string
): Promise<WarSynergy> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy`,
    'Failed to add synergy attacker',
    jsonBody('POST', {
      champion_user_id: championUserId,
      target_champion_user_id: targetChampionUserId,
    })
  )
}

export async function removeWarSynergy(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string
): Promise<void> {
  await api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy/${championUserId}`,
    'Failed to remove synergy attacker',
    { method: 'DELETE' }
  )
}

// ─── Available Prefight Attackers API ─────────────────────

export async function getAvailablePrefightAttackers(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<AvailableAttacker[]> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/available-prefight-attackers`,
    'Failed to load available pre-fight attackers'
  )
}

// ─── Prefight API ─────────────────────────────────────────

export async function getWarPrefights(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<WarPrefight[]> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/prefight`,
    'Failed to load pre-fight attackers'
  )
}

export async function addWarPrefight(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string,
  targetNodeNumber: number
): Promise<WarPrefight> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/prefight`,
    'Failed to add pre-fight attacker',
    jsonBody('POST', {
      champion_user_id: championUserId,
      target_node_number: targetNodeNumber,
    })
  )
}

export async function removeWarPrefight(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string,
  targetNodeNumber: number
): Promise<void> {
  await api(
    `/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/prefight/${championUserId}/node/${targetNodeNumber}`,
    'Failed to remove pre-fight attacker',
    { method: 'DELETE' }
  )
}
