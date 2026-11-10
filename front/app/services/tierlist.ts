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

/** The champion catalog. Answers signed out — the tier list is public. */
export async function fetchCatalog(): Promise<CatalogResponse> {
  return api('/catalog/champions', 'Failed to load the champion catalog')
}
