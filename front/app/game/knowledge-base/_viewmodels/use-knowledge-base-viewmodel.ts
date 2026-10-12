'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  getFightRecords,
  getSeasons,
  getAccessibleAlliances,
  type PaginatedFightRecords,
  type FightRecordFilters,
  FIGHT_RECORD_SORT_FIELDS,
  FIGHT_RECORD_SOURCES,
  type FightRecordSortField,
  type FightRecordSource,
  type Season,
  type AccessibleAlliance,
} from '@/app/services/fight-records'
import {
  SEASON_FORMAT_FILTERS,
  SEASON_SELECTORS,
  type SeasonFormatFilter,
  type SeasonSelector,
} from '@/app/services/season'
import { SORT_ORDERS, type SortOrder } from '@/app/services/utils'
import { isOneOf } from '@/app/lib/utils'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { reportNote } from '@/app/services/moderation'
import { withToast } from '@/app/lib/with-toast'
import { useI18n } from '@/app/i18n'

interface Filters {
  champion_id: string | null
  defender_champion_id: string | null
  node_number: string
  tier: string
  game_account_pseudo: string
}

const DEFAULT_FILTERS: Filters = {
  champion_id: null,
  defender_champion_id: null,
  node_number: '',
  tier: '',
  game_account_pseudo: '',
}

const DEFAULT_SOURCE: FightRecordSource = 'all'

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    champion_id: params.get('champion_id'),
    defender_champion_id: params.get('defender_champion_id'),
    node_number: params.get('node_number') ?? '',
    tier: params.get('tier') ?? '',
    game_account_pseudo: params.get('game_account_pseudo') ?? '',
  }
}

function getInitialParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

export function useKnowledgeBaseViewModel() {
  const { t } = useI18n()
  const pathname = usePathname()
  const requestIdRef = useRef(0)

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(getInitialParams()))
  const [planningErrorOnly, setPlanningErrorOnly] = useState<boolean | null>(() => {
    const v = getInitialParams().get('planning_error_only')
    return v === 'true' ? true : null
  })
  const [debouncedPseudo, setDebouncedPseudo] = useState(
    () => getInitialParams().get('game_account_pseudo') ?? ''
  )
  const [debouncedNodeNumber, setDebouncedNodeNumber] = useState(
    () => getInitialParams().get('node_number') ?? ''
  )
  const [page, setPage] = useState(() => Number(getInitialParams().get('page') ?? '1'))
  const [size, setSize] = useState(() => Number(getInitialParams().get('size') ?? '20'))
  const [sortBy, setSortBy] = useState<FightRecordSortField>(() => {
    const value = getInitialParams().get('sort_by')
    return isOneOf(FIGHT_RECORD_SORT_FIELDS, value) ? value : 'created_at'
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const value = getInitialParams().get('sort_order')
    return isOneOf(SORT_ORDERS, value) ? value : 'desc'
  })
  const [seasonSelector, setSeasonSelector] = useState<SeasonSelector>(() => {
    const value = getInitialParams().get('season_selector')
    return isOneOf(SEASON_SELECTORS, value) ? value : 'all_seasons'
  })
  const [seasonId, setSeasonId] = useState<string | null>(() => getInitialParams().get('season_id'))
  const [seasonFormat, setSeasonFormat] = useState<SeasonFormatFilter>(() => {
    const value = getInitialParams().get('season_format')
    return isOneOf(SEASON_FORMAT_FILTERS, value) ? value : 'all'
  })
  const [seasons, setSeasons] = useState<Season[]>([])
  const [allianceId, setAllianceId] = useState<string | null>(() =>
    getInitialParams().get('alliance_id')
  )
  const [source, setSource] = useState<FightRecordSource>(() => {
    const value = getInitialParams().get('source')
    return isOneOf(FIGHT_RECORD_SOURCES, value) ? value : DEFAULT_SOURCE
  })
  const [accessibleAlliances, setAccessibleAlliances] = useState<AccessibleAlliance[]>([])
  const { roles } = useAllianceContext()
  const canImport = accessibleAlliances.some(
    (a) => roles[a.id]?.is_owner || roles[a.id]?.is_officer
  )
  const [data, setData] = useState<PaginatedFightRecords | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPseudo(filters.game_account_pseudo), 300)
    return () => clearTimeout(timer)
  }, [filters.game_account_pseudo])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNodeNumber(filters.node_number), 300)
    return () => clearTimeout(timer)
  }, [filters.node_number])

  useEffect(() => {
    getSeasons()
      .then(setSeasons)
      .catch(() => setSeasons([]))
  }, [])

  useEffect(() => {
    getAccessibleAlliances()
      .then(setAccessibleAlliances)
      .catch(() => setAccessibleAlliances([]))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.champion_id) params.set('champion_id', filters.champion_id)
    if (filters.defender_champion_id)
      params.set('defender_champion_id', filters.defender_champion_id)
    if (filters.node_number) params.set('node_number', filters.node_number)
    if (filters.tier) params.set('tier', filters.tier)
    if (filters.game_account_pseudo) params.set('game_account_pseudo', filters.game_account_pseudo)
    if (planningErrorOnly !== null) params.set('planning_error_only', String(planningErrorOnly))
    if (seasonSelector !== 'all_seasons') params.set('season_selector', seasonSelector)
    if (seasonId) params.set('season_id', seasonId)
    if (seasonFormat !== 'all') params.set('season_format', seasonFormat)
    if (allianceId) params.set('alliance_id', allianceId)
    if (source !== DEFAULT_SOURCE) params.set('source', source)
    if (page !== 1) params.set('page', String(page))
    if (size !== 20) params.set('size', String(size))
    if (sortBy !== 'created_at') params.set('sort_by', sortBy)
    if (sortOrder !== 'desc') params.set('sort_order', sortOrder)
    const query = params.toString()
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }, [
    filters,
    planningErrorOnly,
    seasonSelector,
    seasonId,
    seasonFormat,
    allianceId,
    source,
    page,
    size,
    sortBy,
    sortOrder,
    pathname,
  ])

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const apiFilters: FightRecordFilters = {
        champion_id: filters.champion_id ?? undefined,
        defender_champion_id: filters.defender_champion_id ?? undefined,
        node_number: debouncedNodeNumber ? Number.parseInt(debouncedNodeNumber) : undefined,
        tier: filters.tier ? Number.parseInt(filters.tier) : undefined,
        game_account_pseudo: debouncedPseudo || undefined,
        planning_error_only: planningErrorOnly ?? undefined,
        season_selector: seasonSelector,
        season_id: seasonId ?? undefined,
        season_format: seasonFormat === 'all' ? undefined : seasonFormat,
        alliance_id: allianceId ?? undefined,
        source,
        page,
        size,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      const result = await getFightRecords(apiFilters)
      if (requestId === requestIdRef.current) setData(result)
    } catch {
      if (requestId === requestIdRef.current) setError('Failed to load fight records.')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [
    filters.champion_id,
    filters.defender_champion_id,
    debouncedNodeNumber,
    filters.tier,
    debouncedPseudo,
    planningErrorOnly,
    seasonSelector,
    seasonId,
    seasonFormat,
    allianceId,
    source,
    page,
    size,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    void load()
  }, [load])

  // A report can push a note past the auto-block threshold, so the page is reloaded.
  const handleReportNote = async (noteId: string) => {
    const reported = await withToast(
      async () => {
        await reportNote(noteId)
        return true
      },
      { success: t.moderation.reportSuccess, error: t.moderation.reportError, onSuccess: load }
    )
    return reported ?? false
  }

  const handleFilterChange = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleSort = (col: FightRecordSortField) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleAllianceChange = (value: string | null) => {
    setAllianceId(value)
    setPage(1)
  }

  const handleSourceChange = (v: string) => {
    if (!isOneOf(FIGHT_RECORD_SOURCES, v)) return
    setSource(v)
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setDebouncedPseudo('')
    setDebouncedNodeNumber('')
    setPlanningErrorOnly(null)
    setSeasonSelector('all_seasons')
    setSeasonId(null)
    setSeasonFormat('all')
    setAllianceId(null)
    setSource(DEFAULT_SOURCE)
    setPage(1)
  }

  const handleSeasonSelectorChange = (value: string) => {
    if (!isOneOf(SEASON_SELECTORS, value)) return
    setSeasonSelector(value)
    if (value === 'specific') {
      setSeasonId(seasons[0]?.id ?? null)
    } else {
      setSeasonId(null)
    }
    setPage(1)
  }

  const handleSeasonFormatChange = (value: string) => {
    if (!isOneOf(SEASON_FORMAT_FILTERS, value)) return
    setSeasonFormat(value)
    setPage(1)
  }

  const handleSeasonIdChange = (value: string | null) => {
    setSeasonId(value)
    setPage(1)
  }

  const handleTogglePlanningError = () => {
    setPlanningErrorOnly((prev) => (prev === true ? null : true))
    setPage(1)
  }

  const hasActiveFilters = Boolean(
    source !== DEFAULT_SOURCE ||
    filters.champion_id ||
    filters.defender_champion_id ||
    filters.node_number ||
    filters.tier ||
    filters.game_account_pseudo ||
    planningErrorOnly !== null ||
    seasonSelector !== 'all_seasons' ||
    seasonFormat !== 'all' ||
    allianceId !== null
  )

  return {
    filters,
    data,
    loading,
    error,
    page,
    size,
    sortBy,
    sortOrder,
    planningErrorOnly,
    seasonSelector,
    seasonId,
    seasonFormat,
    seasons,
    allianceId,
    accessibleAlliances,
    canImport,
    source,
    hasActiveFilters,
    handleFilterChange,
    handleTogglePlanningError,
    handleSeasonSelectorChange,
    handleSeasonIdChange,
    handleSeasonFormatChange,
    handleAllianceChange,
    handleSourceChange,
    handleSort,
    handleClearFilters,
    handleReportNote,
    setPage,
    setSize,
  }
}
