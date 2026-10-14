import { useEffect, useState } from 'react'
import { getChampions, type Champion } from '@/app/services/champions'

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

// ponytail: one page of 1000 covers the catalog; paginate if it ever grows past it.
const CATALOG_SIZE = 1000

export function useCatalogPicks(enabled: boolean, { prefightOnly }: { prefightOnly: boolean }) {
  const [catalog, setCatalog] = useState<Champion[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled || catalog.length) return
    setLoading(true)
    getChampions({ size: CATALOG_SIZE, orderBy: 'name', hasPrefight: prefightOnly ? 'true' : null })
      .then((r) => setCatalog(r.champions))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [enabled, prefightOnly, catalog.length])
  return { catalog, loading }
}

/** Champions the player has no recorded copy of (free or on defense), minus bans. */
export function catalogCandidates(
  catalog: Champion[],
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
