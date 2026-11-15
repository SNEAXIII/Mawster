import { api } from '@/app/services/utils'

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

/** A regular season the saga tab can show. */
export interface CatalogSeason {
  number: number
  status: 'upcoming' | 'active' | 'ended'
}

/** The champion catalog, for the current season or the given one. Answers signed out. */
export async function fetchCatalog(seasonNumber?: number): Promise<CatalogResponse> {
  const query = seasonNumber === undefined ? '' : `?season_number=${seasonNumber}`
  return api(`/catalog/champions${query}`, 'Failed to load the champion catalog')
}

/** The regular seasons, newest first. Answers signed out. */
export async function fetchCatalogSeasons(): Promise<CatalogSeason[]> {
  return api('/catalog/seasons', 'Failed to load the seasons')
}
