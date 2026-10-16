import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, type CatalogChampion } from '@/app/services/tierlist'

export interface CatalogPick {
  champion_id: string
  champion_name: string
  champion_alias: string | null
  image_url: string | null
  is_saga_attacker: boolean
  is_saga_defender: boolean
  game_account_id: string
  game_pseudo: string
}

// One request per page load, shared by every selector; a failure lets the next open retry.
let catalogRequest: Promise<CatalogChampion[]> | null = null
function loadCatalog(): Promise<CatalogChampion[]> {
  catalogRequest ??= fetchCatalog()
    .then((r) => r.champions)
    .catch((err: unknown) => {
      catalogRequest = null
      throw err
    })
  return catalogRequest
}

/** The champion catalog, loaded when the dialog opens so the toggle sends no request. */
export function useCatalogPicks(open: boolean, { prefightOnly }: { prefightOnly: boolean }) {
  const [champions, setChampions] = useState<CatalogChampion[]>([])
  useEffect(() => {
    if (!open || champions.length) return
    loadCatalog()
      .then(setChampions)
      .catch(() => {})
  }, [open, champions.length])
  const catalog = useMemo(
    () => (prefightOnly ? champions.filter((c) => c.has_prefight) : champions),
    [champions, prefightOnly]
  )
  return { catalog }
}

/** Champions the player has no recorded copy of (free or on defense), minus bans. */
export function catalogCandidates(
  catalog: CatalogChampion[],
  taken: { game_account_id: string; champion_id: string }[],
  bannedIds: Set<string>,
  account: { id: string; pseudo: string }
): CatalogPick[] {
  const owned = new Set(
    taken.filter((a) => a.game_account_id === account.id).map((a) => a.champion_id)
  )
  return catalog
    .filter((c) => !owned.has(c.id) && !bannedIds.has(c.id))
    .map((c) => ({
      champion_id: c.id,
      champion_name: c.name,
      champion_alias: c.alias,
      image_url: c.image_url,
      is_saga_attacker: c.is_saga_attacker,
      is_saga_defender: c.is_saga_defender,
      game_account_id: account.id,
      game_pseudo: account.pseudo,
    }))
}
