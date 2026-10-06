import { api, jsonBody } from '@/app/services/utils'
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

export const championClasses = [
  { value: 'all', label: 'All' },
  ...CLASS_ORDER.map((c) => ({ value: c, label: c })),
]

// ─── API ─────────────────────────────────────────────────
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

  return api(`/champions?${qs}`, 'Erreur lors de la récupération des champions')
}

export const updateChampionAlias = async (
  championId: string,
  alias: string | null
): Promise<void> => {
  await api(
    `/admin/champions/${championId}/alias`,
    "Erreur lors de la mise à jour de l'alias",
    jsonBody('PATCH', { alias })
  )
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
  return api(
    '/admin/champions/load',
    'Erreur lors du chargement des champions',
    jsonBody('POST', champions)
  )
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
  const data: FetchChampionsResponse = await api(
    '/champions?page=1&size=9999',
    "Erreur lors de l'export des champions"
  )
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
  await api(`/admin/champions/${championId}`, 'Erreur lors de la suppression du champion', {
    method: 'DELETE',
  })
}

export const toggleChampionAscendable = async (
  championId: string
): Promise<{ is_ascendable: boolean }> => {
  return api(
    `/admin/champions/${championId}/ascendable`,
    "Erreur lors du basculement de l'ascension",
    { method: 'PATCH' }
  )
}

export const toggleChampionSevenStars = async (
  championId: string
): Promise<{ is_7_stars_available: boolean }> => {
  return api(
    `/admin/champions/${championId}/seven-stars`,
    'Erreur lors du basculement de la disponibilité 7 étoiles',
    { method: 'PATCH' }
  )
}

export const toggleChampionPrefight = async (
  championId: string
): Promise<{ has_prefight: boolean }> => {
  return api(`/admin/champions/${championId}/prefight`, 'Erreur lors du basculement du précombat', {
    method: 'PATCH',
  })
}

export const setChampionSagaRole = async (
  seasonId: string,
  championId: string,
  body: { is_saga_attacker: boolean; is_saga_defender: boolean }
): Promise<{ is_saga_attacker: boolean; is_saga_defender: boolean }> => {
  return api(
    `/admin/seasons/${seasonId}/saga/${championId}`,
    'Erreur lors de la mise à jour du rôle saga',
    jsonBody('PUT', body)
  )
}

// Portraits render at ≤54 CSS px, so 110 stays sharp at 2x; bigger falls back to the 256px source.
// Keep in sync with resize_sizes (static-assets/pyproject.toml) and IMAGE_SIZES (static-assets/server).
export const THUMBNAIL_SIZES = [110]

/**
 * Build a sized champion image URL.
 * Converts e.g. "/static/champions/cyclops_blue_team.png"
 * into "/static/champions/cyclops_blue_team_110x110.png" when size ≤ 110.
 * A size bigger than every thumbnail, or no size, returns the original URL.
 */
export function getChampionImageUrl(
  imageUrl: string | null | undefined,
  requestedSize?: number
): string | null {
  if (!imageUrl) return null
  const size = requestedSize && THUMBNAIL_SIZES.find((s) => s >= requestedSize)
  if (!size) return imageUrl
  // Insert _NxN before the file extension
  const dotIndex = imageUrl.lastIndexOf('.')
  if (dotIndex === -1) return `${imageUrl}_${size}x${size}.png`
  return `${imageUrl.substring(0, dotIndex)}_${size}x${size}${imageUrl.substring(dotIndex)}`
}
