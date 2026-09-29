import type { Champion } from './champions'
import { api, jsonBody } from '@/app/services/utils'

// ─── Types ───────────────────────────────────────────────
export enum ChampionRarity {
  SIX_R4 = '6r4',
  SIX_R5 = '6r5',
  SEVEN_R1 = '7r1',
  SEVEN_R2 = '7r2',
  SEVEN_R3 = '7r3',
  SEVEN_R4 = '7r4',
  SEVEN_R5 = '7r5',
  SEVEN_R6 = '7r6',
}

export const RARITIES = Object.values(ChampionRarity)

export const RARITY_LABELS: Record<string, string> = {
  '6r4': '6R4',
  '6r5': '6R5',
  '7r1': '7R1',
  '7r2': '7R2',
  '7r3': '7R3',
  '7r4': '7R4',
  '7r5': '7R5',
  '7r6': '7R6',
}

export const SIGNATURE_PRESETS = [0, 20, 100, 200]

/** Frame image URL per star level */
export function getStarFrameUrl(rarity: string): string {
  const stars = rarity.charAt(0) // '6' or '7'
  return `/static/frame/${stars}_stars.png`
}

export function splitRarity(rarity: string): { stars: number; rank: number } | null {
  const parts = /^(\d+)r(\d+)$/i.exec(rarity)
  if (!parts) return null
  return { stars: Number.parseInt(parts[1], 10), rank: Number.parseInt(parts[2], 10) }
}

/** Shorten a champion name for card display.
 *  Removes parenthesized suffixes: "Spider-Woman (Jessica Drew)" → "Spider-Woman" */
export function shortenChampionName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed.endsWith(')')) return trimmed
  // The suffix carries no ')' of its own, so it opens at the first '(' following any earlier one.
  const open = trimmed.indexOf('(', trimmed.lastIndexOf(')', trimmed.length - 2) + 1)
  return open === -1 ? trimmed : trimmed.slice(0, open).trim()
}

/** Numeric sort value for a rarity string (higher = better). Used for descending sort. */
export function raritySortValue(rarity: string): number {
  const parsed = splitRarity(rarity)
  if (!parsed) return 0
  return parsed.stars * 10 + parsed.rank
}

export interface RosterEntry {
  id: string
  game_account_id: string
  champion_id: string
  rarity: string
  signature: number
  champion_name: string
  champion_class: string
  alias: string | null
  image_url: string | null
  is_preferred_attacker: boolean
  ascension: number
  is_ascendable: boolean
  has_prefight: boolean
  is_saga_attacker: boolean
  is_saga_defender: boolean
}

export interface BulkChampionEntry {
  champion_name: string
  rarity: string
  signature: number
  is_preferred_attacker?: boolean
  ascension?: number
}

// ─── Champions (non-admin, for search) ───────────────────
export const searchChampions = async (
  search: string,
  size: number = 20
): Promise<{ champions: Champion[] }> => {
  const qs = new URLSearchParams({ page: '1', size: String(size) })
  if (search.trim()) qs.set('search', search.trim())
  return api(`/champions?${qs}`, 'Erreur lors de la recherche de champions')
}

// ─── Roster API ──────────────────────────────────────────
export const getRoster = async (gameAccountId: string): Promise<RosterEntry[]> => {
  return api(
    `/champion-users/by-account/${gameAccountId}`,
    'Erreur lors de la récupération du roster'
  )
}

export const updateChampionInRoster = async (
  gameAccountId: string,
  championId: string,
  rarity: string,
  signature: number,
  isPreferredAttacker: boolean = false,
  ascension: number = 0
): Promise<RosterEntry> => {
  return api(
    '/champion-users',
    'Erreur lors de la mise à jour du roster',
    jsonBody('POST', {
      game_account_id: gameAccountId,
      champion_id: championId,
      rarity,
      signature,
      is_preferred_attacker: isPreferredAttacker,
      ascension,
    })
  )
}

export const bulkUpdateRoster = async (
  gameAccountId: string,
  champions: BulkChampionEntry[]
): Promise<RosterEntry[]> => {
  return api(
    '/champion-users/bulk',
    'Erreur lors de la mise à jour en masse du roster',
    jsonBody('POST', {
      game_account_id: gameAccountId,
      champions,
    })
  )
}

export const deleteRosterEntry = async (championUserId: string): Promise<void> => {
  await api(`/champion-users/${championUserId}`, 'Erreur lors de la suppression du roster', {
    method: 'DELETE',
  })
}

/** Compute the next rarity (one rank up within the same star level).
 *  A 6 champion stays 6 — cannot jump to 7.
 *  Returns null if already at max rank for that star level. */
export function getNextRarity(rarity: string): string | null {
  const parsed = splitRarity(rarity)
  if (!parsed) return null
  const nextRarity = `${parsed.stars}r${parsed.rank + 1}` as ChampionRarity
  if (!RARITIES.includes(nextRarity)) return null
  return nextRarity
}

export const upgradeChampionRank = async (championUserId: string): Promise<RosterEntry> => {
  return api(
    `/champion-users/${championUserId}/upgrade`,
    "Erreur lors de l'amélioration du champion",
    { method: 'PATCH' }
  )
}

export const ascendChampion = async (championUserId: string): Promise<RosterEntry> => {
  return api(`/champion-users/${championUserId}/ascend`, "Erreur lors de l'ascension du champion", {
    method: 'PATCH',
  })
}

export const togglePreferredAttacker = async (championUserId: string): Promise<RosterEntry> => {
  return api(
    `/champion-users/${championUserId}/preferred-attacker`,
    "Erreur lors du basculement de l'attaquant préféré",
    { method: 'PATCH' }
  )
}

// ─── Upgrade Requests ────────────────────────────────────

export interface UpgradeRequest {
  id: string
  champion_user_id: string
  requester_game_account_id: string
  requester_pseudo: string
  requested_rarity: string
  current_rarity: string
  champion_name: string
  champion_class: string
  image_url: string | null
  created_at: string
  done_at: string | null
}

export const createUpgradeRequest = async (
  championUserId: string,
  requestedRarity: string
): Promise<UpgradeRequest> => {
  return api(
    '/champion-users/upgrade-requests',
    "Erreur lors de la demande d'upgrade",
    jsonBody('POST', {
      champion_user_id: championUserId,
      requested_rarity: requestedRarity,
    })
  )
}

export const getUpgradeRequests = async (gameAccountId: string): Promise<UpgradeRequest[]> => {
  return api(
    `/champion-users/upgrade-requests/by-account/${gameAccountId}`,
    'Erreur lors de la récupération des demandes'
  )
}

export const cancelUpgradeRequest = async (requestId: string): Promise<void> => {
  await api(
    `/champion-users/upgrade-requests/${requestId}`,
    "Erreur lors de l'annulation de la demande",
    { method: 'DELETE' }
  )
}
