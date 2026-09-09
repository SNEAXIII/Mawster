'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getChampions,
  type Champion,
  type ChampionOrderBy,
  type ChampionOrderDir,
} from '@/app/services/champions'
import { listSeasons, getCurrentSeason, type Season } from '@/app/services/season'
import { useI18n } from '@/app/i18n'
import {
  BASE_SIZE,
  EMPTY_FILTERS,
  countActiveFilters,
  type ChampionFiltersState,
} from './champion-filters'
import { useChampionActions } from './use-champion-actions'

export function useChampionsViewModel() {
  const { t } = useI18n()

  const [champions, setChampions] = useState<Champion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState<ChampionFiltersState>(EMPTY_FILTERS)
  const [orderBy, setOrderBy] = useState<ChampionOrderBy>('name')
  const [orderDir, setOrderDir] = useState<ChampionOrderDir>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPage, setTotalPage] = useState(1)
  const [perPage, setPerPage] = useState(BASE_SIZE)

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeCount = countActiveFilters(filters)
  const canReset = activeCount > 0 || filters.search !== '' || orderBy !== 'name'

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await getChampions({
        page: Math.max(currentPage, 1),
        size: perPage,
        championClass: filters.championClass,
        search: filters.search || null,
        is7StarsAvailable: filters.is_7_stars_available,
        isAscendable: filters.is_ascendable,
        hasPrefight: filters.has_prefight,
        seasonId: selectedSeasonId,
        isSagaAttacker: filters.is_saga_attacker,
        isSagaDefender: filters.is_saga_defender,
        orderBy,
        orderDir,
      })
      setChampions(data.champions)
      setCurrentPage(Math.min(currentPage, data.total_pages || 1))
      setTotalPage(data.total_pages)
    } catch (err) {
      setError(
        (err as { status?: number }).status === 401
          ? t.dashboard.errors.unauthorized
          : t.champions.errors.loadError
      )
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, filters, selectedSeasonId, orderBy, orderDir])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(load, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load])

  useEffect(() => {
    listSeasons()
      .then(async (list) => {
        setSeasons(list)
        const current = await getCurrentSeason()
        setSelectedSeasonId(current?.id ?? list[0]?.id ?? null)
      })
      .catch(() => setError(t.champions.errors.loadError))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setFilter(key: keyof ChampionFiltersState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  function clearFilter(key: keyof ChampionFiltersState) {
    setFilter(key, 'all')
  }

  function resetAll() {
    setFilters(EMPTY_FILTERS)
    setPerPage(BASE_SIZE)
    setOrderBy('name')
    setOrderDir('asc')
    setCurrentPage(1)
  }

  function toggleSort(field: ChampionOrderBy) {
    if (orderBy === field) {
      setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrderBy(field)
      setOrderDir('asc')
    }
    setCurrentPage(1)
  }

  const actions = useChampionActions({
    champions,
    setChampions,
    selectedSeasonId,
    reload: load,
  })

  return {
    champions,
    isLoading,
    error,
    setError,
    filters,
    setFilter,
    clearFilter,
    resetAll,
    activeCount,
    canReset,
    orderBy,
    orderDir,
    toggleSort,
    currentPage,
    setCurrentPage,
    totalPage,
    perPage,
    setPerPage,
    seasons,
    selectedSeasonId,
    setSelectedSeasonId,
    sagaDisabled: !selectedSeasonId,
    reload: load,
    ...actions,
  }
}
