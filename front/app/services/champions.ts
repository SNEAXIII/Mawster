import { PROXY, jsonHeaders } from '@/app/services/utils'
import { CLASS_ORDER } from '@/app/lib/champion-class'

// ─── Types ───────────────────────────────────────────────
export interface Champion {
  id: string
  name: string
  champion_class: string
  image_url: string | null
  is_7_stars_available: boolean
  is_ascendable: boolean
  has_prefight: boolean
  alias: string | null
  // Filled only when the query carried a seasonId; false otherwise.
  is_saga_attacker: boolean
  is_saga_defender: boolean
}

export interface FetchChampionsResponse {
  champions: Champion[]
  total_champions: number
  total_pages: number
  current_page: number
}

interface ApiError {
  detail?: string
  message?: string
  statusCode?: number
}

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data: ApiError = await response.json().catch(() => ({}))
  const msg = data.message ?? data.detail ?? fallback
  const err = new Error(`Erreur ${response.status}: ${msg}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

export const championClasses = [
  { value: 'all', label: 'All' },
  ...CLASS_ORDER.map((c) => ({ value: c, label: c })),
]

// ─── API ─────────────────────────────────────────────────
export const boolFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

export type BoolFilter = 'all' | 'true' | 'false'
export type ChampionOrderBy = 'name' | 'champion_class'
export type ChampionOrderDir = 'asc' | 'desc'

export interface ChampionQuery {
  page?: number
  size?: number
  championClass?: string | null
  search?: string | null
  is7StarsAvailable?: BoolFilter | null
  isAscendable?: BoolFilter | null
  hasPrefight?: BoolFilter | null
  seasonId?: string | null
  isSagaAttacker?: BoolFilter | null
  isSagaDefender?: BoolFilter | null
  orderBy?: ChampionOrderBy
  orderDir?: ChampionOrderDir
}

export const getChampions = async (query: ChampionQuery = {}): Promise<FetchChampionsResponse> => {
  const { page = 1, size = 20, seasonId, orderBy, orderDir } = query
  const qs = new URLSearchParams({ page: String(page), size: String(size) })
  if (query.championClass && query.championClass !== 'all')
    qs.set('champion_class', query.championClass)
  if (query.search?.trim()) qs.set('search', query.search.trim())
  if (seasonId) qs.set('season_id', seasonId)
  if (orderBy) qs.set('order_by', orderBy)
  if (orderDir) qs.set('order_dir', orderDir)

  const boolParams: [string, BoolFilter | null | undefined][] = [
    ['is_7_stars_available', query.is7StarsAvailable],
    ['is_ascendable', query.isAscendable],
    ['has_prefight', query.hasPrefight],
    // The API rejects these without a season_id, so they are dropped when none is set.
    ['is_saga_attacker', seasonId ? query.isSagaAttacker : null],
    ['is_saga_defender', seasonId ? query.isSagaDefender : null],
  ]
  for (const [key, value] of boolParams) {
    if (value && value !== 'all') qs.set(key, value)
  }

  const response = await fetch(`${PROXY}/champions?${qs}`, { headers: jsonHeaders })
  await throwOnError(response, 'Erreur lors de la récupération des champions')
  return response.json()
}

export const updateChampionAlias = async (
  championId: string,
  alias: string | null
): Promise<void> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}/alias`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ alias }),
  })
  await throwOnError(response, "Erreur lors de la mise à jour de l'alias")
}

export const loadChampions = async (
  champions: {
    name: string
    champion_class: string
    image_url?: string | null
    alias?: string | null
    is_7_stars_available?: boolean
    is_ascendable?: boolean
    has_prefight?: boolean
  }[]
): Promise<{ message: string; created: number; updated: number; skipped: number }> => {
  const response = await fetch(`${PROXY}/admin/champions/load`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(champions),
  })
  await throwOnError(response, 'Erreur lors du chargement des champions')
  return response.json()
}

export const exportAllChampions = async (): Promise<
  {
    name: string
    champion_class: string
    image_url: string | null
    alias: string | null
    is_7_stars_available: boolean
    is_ascendable: boolean
    has_prefight: boolean
  }[]
> => {
  const response = await fetch(`${PROXY}/champions?page=1&size=9999`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de l'export des champions")
  const data: FetchChampionsResponse = await response.json()
  return data.champions.map((c) => ({
    name: c.name,
    champion_class: c.champion_class,
    image_url: c.image_url,
    alias: c.alias,
    is_7_stars_available: c.is_7_stars_available,
    is_ascendable: c.is_ascendable,
    has_prefight: c.has_prefight,
  }))
}

export const deleteChampion = async (championId: string): Promise<void> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la suppression du champion')
}

export const toggleChampionAscendable = async (
  championId: string
): Promise<{ is_ascendable: boolean }> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}/ascendable`, {
    method: 'PATCH',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors du basculement de l'ascension")
  return response.json()
}

export const toggleChampionSevenStars = async (
  championId: string
): Promise<{ is_7_stars_available: boolean }> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}/seven-stars`, {
    method: 'PATCH',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors du basculement de la disponibilité 7 étoiles')
  return response.json()
}

export const toggleChampionPrefight = async (
  championId: string
): Promise<{ has_prefight: boolean }> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}/prefight`, {
    method: 'PATCH',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors du basculement du précombat')
  return response.json()
}

export const getSeasonSagaRoles = async (
  seasonId: string
): Promise<{ champion_id: string; is_saga_attacker: boolean; is_saga_defender: boolean }[]> => {
  const response = await fetch(`${PROXY}/admin/seasons/${seasonId}/saga`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors du chargement des rôles saga')
  return response.json()
}

export const setChampionSagaRole = async (
  seasonId: string,
  championId: string,
  body: { is_saga_attacker: boolean; is_saga_defender: boolean }
): Promise<{ is_saga_attacker: boolean; is_saga_defender: boolean }> => {
  const response = await fetch(`${PROXY}/admin/seasons/${seasonId}/saga/${championId}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  await throwOnError(response, 'Erreur lors de la mise à jour du rôle saga')
  return response.json()
}

/**
 * Build a sized champion image URL.
 * Converts e.g. "/static/champions/cyclops_blue_team.png"
 * into "/static/champions/cyclops_blue_team_40x40.png" when size=40.
 * If no size is given or imageUrl is null, returns the original URL.
 */
export function getChampionImageUrl(
  imageUrl: string | null | undefined,
  size?: number
): string | null {
  if (!imageUrl) return null
  if (!size) return imageUrl
  // Insert _NxN before the file extension
  const dotIndex = imageUrl.lastIndexOf('.')
  if (dotIndex === -1) return `${imageUrl}_${size}x${size}.png`
  return `${imageUrl.substring(0, dotIndex)}_${size}x${size}${imageUrl.substring(dotIndex)}`
}
