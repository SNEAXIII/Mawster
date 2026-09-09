import { PROXY, jsonHeaders } from '@/app/services/utils'

// ─── Types ───────────────────────────────────────────────

/** One catalog champion as the public catalog serves it. */
export interface CatalogChampion {
  id: string
  name: string
  champion_class: string
  image_url: string | null
  alias: string | null
  is_7_stars_available: boolean
  is_ascendable: boolean
  has_prefight: boolean
  is_saga_attacker: boolean
  is_saga_defender: boolean
}

export interface CatalogResponse {
  season_number: number | null
  champions: CatalogChampion[]
}

/** The marks a champion carries inside one tier list. */
export interface TierListTag {
  champion_id: string
  is_attacker: boolean
  is_defender: boolean
  is_alliance_war: boolean
  is_battlegrounds: boolean
  is_awakened: boolean
  signature: number
}

export interface TierListTier {
  id: string
  label: string
  color: string
  position: number
  champion_ids: string[]
}

export interface TierListDetail {
  id: string
  title: string
  created_at: string
  tiers: TierListTier[]
  tags: TierListTag[]
}

export interface TierListSummary {
  id: string
  title: string
  created_at: string
  tier_count: number
  ranked_champion_count: number
}

/** What a save sends: the board whole, rows in order, champions in order. */
export interface TierListSavePayload {
  title: string
  tiers: { label: string; color: string; champion_ids: string[] }[]
  tags: TierListTag[]
}

interface ApiError {
  detail?: string
  message?: string
}

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data: ApiError = await response.json().catch(() => ({}))
  const message = data.message ?? data.detail ?? fallback
  const error = new Error(message)
  ;(error as Error & { status: number }).status = response.status
  throw error
}

// ─── Catalog ─────────────────────────────────────────────

/** The champion catalog. Answers signed out — the tier list is public. */
export async function fetchCatalog(): Promise<CatalogResponse> {
  const response = await fetch(`${PROXY}/catalog/champions`, { headers: jsonHeaders })
  await throwOnError(response, 'Failed to load the champion catalog')
  return response.json()
}

// ─── Tier lists ──────────────────────────────────────────

export async function fetchTierLists(): Promise<TierListSummary[]> {
  const response = await fetch(`${PROXY}/tierlists`, { headers: jsonHeaders })
  await throwOnError(response, 'Failed to load your tier lists')
  return response.json()
}

export async function fetchTierList(id: string): Promise<TierListDetail> {
  const response = await fetch(`${PROXY}/tierlists/${id}`, { headers: jsonHeaders })
  await throwOnError(response, 'Failed to load this tier list')
  return response.json()
}

export async function createTierList(payload: TierListSavePayload): Promise<TierListDetail> {
  const response = await fetch(`${PROXY}/tierlists`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  await throwOnError(response, 'Failed to create the tier list')
  return response.json()
}

export async function saveTierList(
  id: string,
  payload: TierListSavePayload
): Promise<TierListDetail> {
  const response = await fetch(`${PROXY}/tierlists/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  await throwOnError(response, 'Failed to save the tier list')
  return response.json()
}

export async function deleteTierList(id: string): Promise<void> {
  const response = await fetch(`${PROXY}/tierlists/${id}`, { method: 'DELETE' })
  await throwOnError(response, 'Failed to delete the tier list')
}
