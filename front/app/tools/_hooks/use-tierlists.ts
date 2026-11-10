'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { defaultBoard } from '../_lib/board'
import {
  MAX_TIER_LISTS,
  createTierList,
  deleteTierList,
  listTierLists,
  type TierListSummary,
} from '../_lib/lists'

interface TierLists {
  lists: TierListSummary[]
  loading: boolean
  error: string | null
  /** Create an empty list and return its id, so the caller can switch to it. */
  create: () => string | null
  remove: (id: string) => void
  refresh: () => void
}

/** The tier lists this browser holds, as the picker shows them: names and counts. */
export function useTierLists(): TierLists {
  const { t } = useI18n()
  const [lists, setLists] = useState<TierListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLists(listTierLists())
    setLoading(false)
  }, [])

  // After mount, never during render: the server has no localStorage.
  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(() => {
    const id = createTierList(defaultBoard())
    if (!id) {
      setError(t.tierlist.listCapReached.replace('{limit}', String(MAX_TIER_LISTS)))
      return null
    }
    setError(null)
    refresh()
    return id
  }, [refresh, t])

  const remove = useCallback(
    (id: string) => {
      deleteTierList(id)
      refresh()
    },
    [refresh]
  )

  return { lists, loading, error, create, remove, refresh }
}
