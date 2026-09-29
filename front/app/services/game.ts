import { api, jsonBody } from '@/app/services/utils'

// ─── Types ───────────────────────────────────────────────
export interface GameAccount {
  id: string
  user_id: string
  alliance_id: string | null
  alliance_group: number | null
  alliance_tag: string | null
  alliance_name: string | null
  game_pseudo: string
  is_primary: boolean
  created_at: string
}

export interface DeletedGameAccount {
  id: string
  game_pseudo: string
  created_at: string
  deleted_at: string
  /** Instant past which the account can no longer be restored */
  restorable_until: string
}

export interface AllianceMember {
  id: string
  game_pseudo: string
  alliance_group: number | null
  is_owner: boolean
  is_officer: boolean
  is_strategist: boolean
}

export interface Alliance {
  id: string
  name: string
  tag: string
  owner_id: string
  owner_pseudo: string
  created_at: string
  officers: AllianceOfficer[]
  members: AllianceMember[]
  member_count: number
  elo: number
  tier: number
}

/** An alliance plus how the current user reaches it: as a member, or as a visitor.
 *  Lives here rather than beside the hook that used to build it, so the context that
 *  now owns the merge and the hook that reads it can both name the type without
 *  importing each other. */
export interface AllianceWithVisitorFlag extends Alliance {
  isVisitor: boolean
}

export interface AllianceOfficer {
  id: string
  game_account_id: string
  game_pseudo: string
  assigned_at: string
}

export interface AllianceVisitor {
  id: string
  alliance_id: string
  game_account_id: string
  game_pseudo: string
  visited_at: string
}

import type { RosterEntry } from '@/app/services/roster'

// ─── Game Accounts ───────────────────────────────────────
export async function getMyGameAccounts(): Promise<GameAccount[]> {
  return api('/game-accounts', 'Erreur lors de la récupération des comptes de jeu')
}

export async function createGameAccount(
  game_pseudo: string,
  is_primary: boolean = false
): Promise<GameAccount> {
  return api(
    '/game-accounts',
    'Erreur lors de la création du compte de jeu',
    jsonBody('POST', { game_pseudo, is_primary })
  )
}

export async function updateGameAccount(
  id: string,
  game_pseudo: string,
  is_primary: boolean
): Promise<GameAccount> {
  return api(
    `/game-accounts/${id}`,
    'Erreur lors de la mise à jour du compte de jeu',
    jsonBody('PUT', { game_pseudo, is_primary })
  )
}

export async function deleteGameAccount(id: string): Promise<void> {
  await api(`/game-accounts/${id}`, 'Erreur lors de la suppression du compte de jeu', {
    method: 'DELETE',
  })
}

export async function getDeletedGameAccounts(): Promise<DeletedGameAccount[]> {
  return api('/game-accounts/deleted', 'Erreur lors de la récupération des comptes supprimés')
}

export async function restoreGameAccount(id: string): Promise<GameAccount> {
  return api(`/game-accounts/${id}/restore`, 'Erreur lors de la restauration du compte de jeu', {
    method: 'POST',
  })
}

// ─── Alliances ───────────────────────────────────────────
export async function getMyAlliances(): Promise<Alliance[]> {
  return api('/alliances/mine', 'Erreur lors de la récupération de vos alliances')
}

export async function getMyVisitedAlliances(): Promise<Alliance[]> {
  return api('/alliances/my-visited', 'Erreur lors de la récupération des alliances visitées')
}

export type AllianceRosterEntry = RosterEntry & {
  game_pseudo: string
  alliance_group: number | null
}

export interface AllianceRosterQuery {
  name?: string
  championClass?: string
  ranks?: string[]
  ascensions?: number[]
  sagaAttacker?: boolean
  sagaDefender?: boolean
  preferredAttacker?: boolean
  allianceGroup?: number
  noGroup?: boolean
  distinctChampionLimit?: number
}

export async function getAllianceRoster(
  allianceId: string,
  query?: AllianceRosterQuery
): Promise<AllianceRosterEntry[]> {
  const qs = new URLSearchParams()
  if (query?.name?.trim()) qs.set('name', query.name.trim())
  if (query?.championClass) qs.set('champion_class', query.championClass)
  for (const r of query?.ranks ?? []) qs.append('ranks', r)
  for (const a of query?.ascensions ?? []) qs.append('ascensions', String(a))
  if (query?.sagaAttacker) qs.set('saga_attacker', 'true')
  if (query?.sagaDefender) qs.set('saga_defender', 'true')
  if (query?.preferredAttacker) qs.set('preferred_attacker', 'true')
  if (query?.allianceGroup != null) qs.set('alliance_group', String(query.allianceGroup))
  if (query?.noGroup) qs.set('no_group', 'true')
  if (query?.distinctChampionLimit != null)
    qs.set('distinct_champion_limit', String(query.distinctChampionLimit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api(
    `/alliances/${allianceId}/roster${suffix}`,
    "Erreur lors de la récupération du roster de l'alliance"
  )
}

export async function getAllianceVisitors(allianceId: string): Promise<AllianceVisitor[]> {
  return api(`/alliances/${allianceId}/visitors`, 'Erreur lors de la récupération des visiteurs')
}

export async function kickVisitor(allianceId: string, gameAccountId: string): Promise<void> {
  await api(
    `/alliances/${allianceId}/visitors/${gameAccountId}`,
    'Erreur lors de la suppression du visiteur',
    { method: 'DELETE' }
  )
}

export async function leaveAsVisitor(allianceId: string): Promise<void> {
  await api(
    `/alliances/${allianceId}/visitors/me`,
    "Erreur lors de la sortie de l'alliance visitée",
    { method: 'DELETE' }
  )
}

export async function inviteVisitor(
  allianceId: string,
  gameAccountId: string
): Promise<AllianceInvitation> {
  return api(
    `/alliances/${allianceId}/invitations`,
    "Erreur lors de l'invitation du visiteur",
    jsonBody('POST', { game_account_id: gameAccountId, type: 'visitor' })
  )
}

export interface RankingHistoryPoint {
  war_number: number
  opponent_name: string
  tier: number | null
  elo_after: number
  win: boolean | null
}

export type SeasonStatus = 'upcoming' | 'active' | 'ended'

export interface RankingHistoryResponse {
  season_number: number | null
  season_status: SeasonStatus | null
  points: RankingHistoryPoint[]
}

export async function fetchAllianceRankingHistory(
  allianceId: string
): Promise<RankingHistoryResponse> {
  return api(
    `/alliances/${allianceId}/ranking-history`,
    "Erreur lors de la récupération de l'historique de classement"
  )
}

export interface AllianceRoleEntry {
  is_owner: boolean
  is_officer: boolean
  can_manage: boolean
  is_strategist: boolean
  can_place: boolean
}

export interface AllianceMyRoles {
  roles: Record<string, AllianceRoleEntry>
  roles_by_account: Record<string, AllianceRoleEntry>
  my_account_ids: string[]
}

export async function getMyAllianceRoles(): Promise<AllianceMyRoles> {
  return api('/alliances/my-roles', 'Erreur lors de la récupération de vos rôles')
}

export async function createAlliance(
  name: string,
  tag: string,
  owner_id: string
): Promise<Alliance> {
  return api(
    '/alliances',
    "Erreur lors de la création de l'alliance",
    jsonBody('POST', { name, tag, owner_id })
  )
}

/**
 * Disband an alliance. `name` is the retyped alliance name: the backend refuses
 * the call unless it matches exactly, so the confirmation is not UI-only.
 */
export async function deleteAlliance(id: string, name: string): Promise<void> {
  await api(
    `/alliances/${id}`,
    "Erreur lors de la suppression de l'alliance",
    jsonBody('DELETE', { name })
  )
}

// ─── Eligibility ─────────────────────────────────────────
export async function getEligibleOwners(): Promise<GameAccount[]> {
  return api('/alliances/eligible-owners', 'Erreur lors de la récupération des comptes éligibles')
}

export async function getEligibleMembers(allianceId: string): Promise<GameAccount[]> {
  return api(
    `/alliances/${allianceId}/eligible-members`,
    'Erreur lors de la récupération des membres éligibles'
  )
}

export async function getEligibleVisitors(allianceId: string): Promise<GameAccount[]> {
  return api(
    `/alliances/${allianceId}/eligible-visitors`,
    'Erreur lors de la récupération des visiteurs éligibles'
  )
}

// ─── Invitations ─────────────────────────────────────────
export interface AllianceInvitation {
  id: string
  alliance_id: string
  alliance_name: string
  alliance_tag: string
  game_account_id: string
  game_account_pseudo: string
  invited_by_game_account_id: string
  invited_by_pseudo: string
  type: 'member' | 'visitor'
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  responded_at: string | null
}

export async function inviteMember(
  allianceId: string,
  gameAccountId: string
): Promise<AllianceInvitation> {
  return api(
    `/alliances/${allianceId}/invitations`,
    "Erreur lors de l'envoi de l'invitation",
    jsonBody('POST', { game_account_id: gameAccountId, type: 'member' })
  )
}

export async function getAllianceInvitations(allianceId: string): Promise<AllianceInvitation[]> {
  return api(
    `/alliances/${allianceId}/invitations`,
    'Erreur lors de la récupération des invitations'
  )
}

export async function cancelInvitation(allianceId: string, invitationId: string): Promise<void> {
  await api(
    `/alliances/${allianceId}/invitations/${invitationId}`,
    "Erreur lors de l'annulation de l'invitation",
    { method: 'DELETE' }
  )
}

export async function getMyInvitations(): Promise<AllianceInvitation[]> {
  return api('/alliances/my-invitations', 'Erreur lors de la récupération de vos invitations')
}

export async function acceptInvitation(invitationId: string): Promise<AllianceInvitation> {
  return api(
    `/alliances/invitations/${invitationId}/accept`,
    "Erreur lors de l'acceptation de l'invitation",
    { method: 'POST' }
  )
}

export async function declineInvitation(invitationId: string): Promise<AllianceInvitation> {
  return api(
    `/alliances/invitations/${invitationId}/decline`,
    "Erreur lors du refus de l'invitation",
    { method: 'POST' }
  )
}

// ─── Members ─────────────────────────────────────────────
export async function removeMember(allianceId: string, gameAccountId: string): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/members/${gameAccountId}`,
    'Erreur lors du retrait du membre',
    { method: 'DELETE' }
  )
}

// ─── Officers ────────────────────────────────────────────
export async function addOfficer(allianceId: string, gameAccountId: string): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/officers`,
    "Erreur lors de l'ajout de l'officer",
    jsonBody('POST', { game_account_id: gameAccountId })
  )
}

export async function removeOfficer(allianceId: string, gameAccountId: string): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/officers`,
    "Erreur lors du retrait de l'officer",
    jsonBody('DELETE', { game_account_id: gameAccountId })
  )
}

// ─── Strategists ─────────────────────────────────────────
export async function addStrategist(allianceId: string, gameAccountId: string): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/strategists`,
    "Erreur lors de l'ajout du stratège",
    jsonBody('POST', { game_account_id: gameAccountId })
  )
}

export async function removeStrategist(
  allianceId: string,
  gameAccountId: string
): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/strategists`,
    'Erreur lors du retrait du stratège',
    jsonBody('DELETE', { game_account_id: gameAccountId })
  )
}

export async function transferOwnership(
  allianceId: string,
  gameAccountId: string
): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/owner`,
    'Failed to transfer ownership',
    jsonBody('PATCH', { game_account_id: gameAccountId })
  )
}

// ─── ELO / Tier ──────────────────────────────────────────
export async function patchAllianceElo(allianceId: string, elo: number): Promise<Alliance> {
  return api(`/alliances/${allianceId}/elo`, 'Failed to update ELO', jsonBody('PATCH', { elo }))
}

export async function patchAllianceTier(allianceId: string, tier: number): Promise<Alliance> {
  return api(`/alliances/${allianceId}/tier`, 'Failed to update Tier', jsonBody('PATCH', { tier }))
}

// ─── Groups ──────────────────────────────────────────────
export async function setMemberGroup(
  allianceId: string,
  gameAccountId: string,
  group: number | null
): Promise<Alliance> {
  return api(
    `/alliances/${allianceId}/members/${gameAccountId}/group`,
    'Erreur lors du changement de groupe',
    jsonBody('PATCH', { group })
  )
}
