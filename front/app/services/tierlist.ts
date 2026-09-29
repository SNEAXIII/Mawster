import { api, jsonBody } from '@/app/services/utils'

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

// ─── Catalog ─────────────────────────────────────────────

/** The champion catalog. Answers signed out — the tier list is public. */
export async function fetchCatalog(): Promise<CatalogResponse> {
  return api('/catalog/champions', 'Failed to load the champion catalog')
}

// ─── Tier lists ──────────────────────────────────────────

export async function fetchTierLists(): Promise<TierListSummary[]> {
  return api('/tierlists', 'Failed to load your tier lists')
}

export async function fetchTierList(id: string): Promise<TierListDetail> {
  return api(`/tierlists/${id}`, 'Failed to load this tier list')
}

export async function createTierList(payload: TierListSavePayload): Promise<TierListDetail> {
  return api('/tierlists', 'Failed to create the tier list', jsonBody('POST', payload))
}

export async function saveTierList(
  id: string,
  payload: TierListSavePayload
): Promise<TierListDetail> {
  return api(`/tierlists/${id}`, 'Failed to save the tier list', jsonBody('PUT', payload))
}

export async function deleteTierList(id: string): Promise<void> {
  await api(`/tierlists/${id}`, 'Failed to delete the tier list', { method: 'DELETE' })
}
