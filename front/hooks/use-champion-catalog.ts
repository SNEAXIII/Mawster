'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Champion, getChampions } from '@/app/services/champions'

const FULL_CATALOG_SIZE = 9999

let sharedCatalog: Promise<Champion[]> | null = null

/** Full champion catalog; `shared` reuses one fetch for the whole session. */
export function loadChampionCatalog(shared = false): Promise<Champion[]> {
  const fetchCatalog = () =>
    getChampions({ page: 1, size: FULL_CATALOG_SIZE }).then((res) => res.champions)
  if (!shared) return fetchCatalog()
  sharedCatalog ??= fetchCatalog().catch((err: unknown) => {
    sharedCatalog = null
    throw err
  })
  return sharedCatalog
}

/** Loads the catalog the first time `enabled` turns true; a failure retries on the next one. */
export function useChampionCatalog(enabled: boolean, shared = false) {
  const [champions, setChampions] = useState<Champion[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled || loaded) return
    loadChampionCatalog(shared)
      .then((list) => {
        setChampions(list)
        setLoaded(true)
      })
      .catch(() => {})
  }, [enabled, loaded, shared])

  return { champions, loaded }
}

const PAGE_SIZE = 60

/** Paginated champion search with a "load more" cursor. */
export function useChampionPages(open: boolean, search: string) {
  const [champions, setChampions] = useState<Champion[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const loadPage = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const data = await getChampions({ page: p, size: PAGE_SIZE, search: q })
      setChampions(p === 1 ? data.champions : (prev) => [...prev, ...data.champions])
      setTotalPages(data.total_pages)
      setPage(p)
    } catch {
      // Keep whatever is already listed; reopening the dialog retries.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadPage(search, 1)
  }, [open, search, loadPage])

  useEffect(() => {
    if (!open) setPage(1)
  }, [open])

  const loadMore = () => loadPage(search, page + 1)

  return { champions, page, totalPages, loading, loadMore }
}
