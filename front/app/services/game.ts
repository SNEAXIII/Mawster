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

export interface AllianceMember {
  id: string
  user_id: string
  game_pseudo: string
  alliance_group: number | null
  is_owner: boolean
  is_officer: boolean
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

// ─── Helpers ─────────────────────────────────────────────
const PROXY = '/api/back'
import { IS_DEV } from '@/app/lib/dev-mode'
import type { RosterEntry } from '@/app/services/roster'

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data = await response.json().catch(() => ({}))
  const msg = data.message ?? data.detail ?? fallback
  const err = new Error(`Erreur ${response.status}: ${msg}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

async function debugFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (IS_DEV) {
    const method = init?.method ?? 'GET'
    const url = typeof input === 'string' ? input : input.toString()
    const payload = init?.body ? JSON.parse(init.body as string) : undefined
    console.debug(`[API] ${method} ${url}`, payload ?? '')
  }
  return fetch(input, init)
}

// ─── Game Accounts ───────────────────────────────────────
export async function getMyGameAccounts(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/game-accounts`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération des comptes de jeu')
  return response.json()
}

export async function createGameAccount(
  game_pseudo: string,
  is_primary: boolean = false
): Promise<GameAccount> {
  const response = await debugFetch(`${PROXY}/game-accounts`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_pseudo, is_primary }),
  })
  await throwOnError(response, 'Erreur lors de la création du compte de jeu')
  return response.json()
}

export async function updateGameAccount(
  id: string,
  game_pseudo: string,
  is_primary: boolean
): Promise<GameAccount> {
  const response = await debugFetch(`${PROXY}/game-accounts/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ game_pseudo, is_primary }),
  })
  await throwOnError(response, 'Erreur lors de la mise à jour du compte de jeu')
  return response.json()
}

export async function deleteGameAccount(id: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/game-accounts/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la suppression du compte de jeu')
}

// ─── Alliances ───────────────────────────────────────────
export async function getAllAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération des alliances')
  return response.json()
}

export async function getMyAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances/mine`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération de vos alliances')
  return response.json()
}

export async function getMyVisitedAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances/my-visited`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération des alliances visitées')
  return response.json()
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
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/roster${suffix}`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la récupération du roster de l'alliance")
  return response.json()
}

export async function getAllianceVisitors(allianceId: string): Promise<AllianceVisitor[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des visiteurs')
  return response.json()
}

export async function kickVisitor(allianceId: string, gameAccountId: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors/${gameAccountId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la suppression du visiteur')
}

export async function leaveAsVisitor(allianceId: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors/me`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la sortie de l'alliance visitée")
}

export async function inviteVisitor(
  allianceId: string,
  gameAccountId: string
): Promise<AllianceInvitation> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/invitations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId, type: 'visitor' }),
  })
  await throwOnError(response, "Erreur lors de l'invitation du visiteur")
  return response.json()
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
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/ranking-history`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la récupération de l'historique de classement")
  return response.json()
}

export interface AllianceRoleEntry {
  is_owner: boolean
  is_officer: boolean
  can_manage: boolean
}

export interface AllianceMyRoles {
  roles: Record<string, AllianceRoleEntry>
  roles_by_account: Record<string, AllianceRoleEntry>
  my_account_ids: string[]
}

export async function getMyAllianceRoles(): Promise<AllianceMyRoles> {
  const response = await debugFetch(`${PROXY}/alliances/my-roles`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération de vos rôles')
  return response.json()
}

export async function createAlliance(
  name: string,
  tag: string,
  owner_id: string
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name, tag, owner_id }),
  })
  await throwOnError(response, "Erreur lors de la création de l'alliance")
  return response.json()
}

export async function deleteAlliance(id: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la suppression de l'alliance")
}

// ─── Eligibility ─────────────────────────────────────────
export async function getEligibleOwners(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/eligible-owners`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération des comptes éligibles')
  return response.json()
}

export async function getEligibleOfficers(allianceId: string): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/eligible-officers`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des officiers éligibles')
  return response.json()
}

export async function getEligibleMembers(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/eligible-members`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des membres éligibles')
  return response.json()
}

export async function getEligibleVisitors(allianceId: string): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/eligible-visitors`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des visiteurs éligibles')
  return response.json()
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
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/invitations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId, type: 'member' }),
  })
  await throwOnError(response, "Erreur lors de l'envoi de l'invitation")
  return response.json()
}

export async function getAllianceInvitations(allianceId: string): Promise<AllianceInvitation[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/invitations`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des invitations')
  return response.json()
}

export async function cancelInvitation(allianceId: string, invitationId: string): Promise<void> {
  const response = await debugFetch(
    `${PROXY}/alliances/${allianceId}/invitations/${invitationId}`,
    {
      method: 'DELETE',
      headers: jsonHeaders,
    }
  )
  await throwOnError(response, "Erreur lors de l'annulation de l'invitation")
}

export async function getMyInvitations(): Promise<AllianceInvitation[]> {
  const response = await debugFetch(`${PROXY}/alliances/my-invitations`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération de vos invitations')
  return response.json()
}

export async function acceptInvitation(invitationId: string): Promise<AllianceInvitation> {
  const response = await debugFetch(`${PROXY}/alliances/invitations/${invitationId}/accept`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de l'acceptation de l'invitation")
  return response.json()
}

export async function declineInvitation(invitationId: string): Promise<AllianceInvitation> {
  const response = await debugFetch(`${PROXY}/alliances/invitations/${invitationId}/decline`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors du refus de l'invitation")
  return response.json()
}

// ─── Members ─────────────────────────────────────────────
export async function removeMember(allianceId: string, gameAccountId: string): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/members/${gameAccountId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors du retrait du membre')
  return response.json()
}

// ─── Officers ────────────────────────────────────────────
export async function addOfficer(allianceId: string, gameAccountId: string): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/officers`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  })
  await throwOnError(response, "Erreur lors de l'ajout de l'officer")
  return response.json()
}

export async function removeOfficer(allianceId: string, gameAccountId: string): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/officers`, {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  })
  await throwOnError(response, "Erreur lors du retrait de l'officer")
  return response.json()
}

export async function transferOwnership(
  allianceId: string,
  gameAccountId: string
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/owner`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  })
  await throwOnError(response, 'Failed to transfer ownership')
  return response.json()
}

// ─── ELO / Tier ──────────────────────────────────────────
export async function patchAllianceElo(allianceId: string, elo: number): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/elo`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ elo }),
  })
  if (!response.ok) throw new Error('Failed to update ELO')
  return response.json()
}

export async function patchAllianceTier(allianceId: string, tier: number): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/tier`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ tier }),
  })
  if (!response.ok) throw new Error('Failed to update Tier')
  return response.json()
}

// ─── Groups ──────────────────────────────────────────────
export async function setMemberGroup(
  allianceId: string,
  gameAccountId: string,
  group: number | null
): Promise<Alliance> {
  const response = await debugFetch(
    `${PROXY}/alliances/${allianceId}/members/${gameAccountId}/group`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ group }),
    }
  )
  await throwOnError(response, 'Erreur lors du changement de groupe')
  return response.json()
}
