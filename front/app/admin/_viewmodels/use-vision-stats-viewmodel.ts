'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ALL_TIME_DAYS,
  getVisionImports,
  getVisionStats,
  getVisionUserStats,
  type PaginatedVisionImports,
  type PaginatedVisionUsers,
  type VisionStats,
  type VisionUserSort,
} from '@/app/services/vision-stats'

export const PERIOD_OPTIONS = [7, 30, 90, 365, ALL_TIME_DAYS] as const
export const DEFAULT_PERIOD = 30
const PAGE_SIZE = 10

export interface UserFilter {
  id: string
  login: string
}

/** Loads the three admin AI-import datasets and keeps their filters in sync.
 *
 * They share one `days` window on purpose: three panels of the same screen
 * disagreeing about the period is the fastest way to make an admin distrust
 * the numbers. Only the pagination and sort are per-panel. */
export function useVisionStatsViewModel() {
  const [days, setDays] = useState<number>(DEFAULT_PERIOD)
  const [stats, setStats] = useState<VisionStats | null>(null)
  const [users, setUsers] = useState<PaginatedVisionUsers | null>(null)
  const [imports, setImports] = useState<PaginatedVisionImports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [userPage, setUserPage] = useState(1)
  const [sortBy, setSortBy] = useState<VisionUserSort>('imports_total')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [importPage, setImportPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [userFilter, setUserFilter] = useState<UserFilter | null>(null)

  const load = useCallback(async () => {
    setError(false)
    try {
      const [nextStats, nextUsers, nextImports] = await Promise.all([
        getVisionStats(days),
        getVisionUserStats({ days, page: userPage, size: PAGE_SIZE, sortBy, sortOrder }),
        getVisionImports({
          days,
          page: importPage,
          size: PAGE_SIZE,
          status: statusFilter || undefined,
          userId: userFilter?.id,
        }),
      ])
      setStats(nextStats)
      setUsers(nextUsers)
      setImports(nextImports)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [days, userPage, sortBy, sortOrder, importPage, statusFilter, userFilter])

  useEffect(() => {
    load()
  }, [load])

  /** Clicking a column header sorts by it, clicking it again flips the order. */
  const toggleSort = (column: VisionUserSort) => {
    setUserPage(1)
    if (column === sortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
      return
    }
    setSortBy(column)
    setSortOrder('desc')
  }

  const changePeriod = (nextDays: number) => {
    setDays(nextDays)
    setUserPage(1)
    setImportPage(1)
  }

  const filterOnUser = (filter: UserFilter | null) => {
    setUserFilter(filter)
    setImportPage(1)
  }

  const changeStatus = (status: string) => {
    setStatusFilter(status)
    setImportPage(1)
  }

  return {
    days,
    changePeriod,
    stats,
    users,
    imports,
    loading,
    error,
    reload: load,
    userPage,
    setUserPage,
    sortBy,
    sortOrder,
    toggleSort,
    importPage,
    setImportPage,
    statusFilter,
    changeStatus,
    userFilter,
    filterOnUser,
  }
}
