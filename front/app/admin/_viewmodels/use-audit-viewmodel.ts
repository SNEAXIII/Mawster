'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import {
  type AuditFilterOptions,
  type AuditFilters,
  type AuditPurgeScope,
  type PaginatedAuditEntries,
  getAuditFilterOptions,
  listAuditEntries,
  purgeAuditEntries,
} from '@/app/services/admin-audit'

const EMPTY_FILTERS: AuditFilters = {
  router: '',
  route: '',
  result: '',
  userId: '',
  dateFrom: '',
  dateTo: '',
}

/** Loads the Admin Audit Entries; any filter change returns to page 1. */
export function useAuditViewModel() {
  const { t } = useI18n()
  const s = t.admin.audit
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [entries, setEntries] = useState<PaginatedAuditEntries | null>(null)
  const [options, setOptions] = useState<AuditFilterOptions>({ routers: [], accounts: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  // Only the latest request may write state: a slow query must not overwrite a newer filter.
  const requestId = useRef(0)
  const optionsRequestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setRefreshing(true)
    setError(false)
    try {
      const next = await listAuditEntries(filters, page, size)
      if (id === requestId.current) setEntries(next)
    } catch {
      if (id === requestId.current) setError(true)
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [filters, page, size])

  const loadOptions = useCallback(async () => {
    const id = ++optionsRequestId.current
    try {
      const next = await getAuditFilterOptions()
      if (id !== optionsRequestId.current) return
      setOptions(next)
      // Same object when nothing changes: an options load must not reload the list.
      setFilters((current) =>
        current.userId && !next.accounts.some((account) => account.id === current.userId)
          ? { ...current, userId: '' }
          : current
      )
    } catch {
      if (id === optionsRequestId.current) toast.error(s.loadError)
    }
  }, [s.loadError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const changeFilters = (patch: Partial<AuditFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  const changeSize = (value: string) => {
    setSize(Number(value))
    setPage(1)
  }

  const purge = async (scope: AuditPurgeScope, beforeDay: string) => {
    try {
      const { deleted } = await purgeAuditEntries(scope, beforeDay)
      toast.success(s.purgeSuccess.replace('{count}', String(deleted)))
      changeFilters({}) // A new filters object is what reloads the list, from page 1.
      await loadOptions()
    } catch {
      toast.error(s.purgeError)
    }
  }

  const routeOptions = filters.router
    ? (options.routers.find((router) => router.name === filters.router)?.routes ?? [])
    : [...new Set(options.routers.flatMap((router) => router.routes))].sort()

  return {
    filters,
    changeFilters,
    resetFilters: () => changeFilters(EMPTY_FILTERS),
    hasFilters: Object.values(filters).some(Boolean),
    options,
    routeOptions,
    entries,
    page,
    setPage,
    size,
    changeSize,
    loading,
    refreshing,
    error,
    reload: load,
    purge,
  }
}
