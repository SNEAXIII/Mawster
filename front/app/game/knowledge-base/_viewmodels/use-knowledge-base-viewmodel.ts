'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  getFightRecords,
  getSeasons,
  getAccessibleAlliances,
  type FightRecord,
  type PaginatedFightRecords,
  type FightRecordFilters,
  type Season,
  type AccessibleAlliance,
} from '@/app/services/fight-records';

interface Filters {
  champion_id: string | null;
  defender_champion_id: string | null;
  node_number: string;
  tier: string;
  game_account_pseudo: string;
}

const DEFAULT_FILTERS: Filters = {
  champion_id: null,
  defender_champion_id: null,
  node_number: '',
  tier: '',
  game_account_pseudo: '',
};

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    champion_id: params.get('champion_id'),
    defender_champion_id: params.get('defender_champion_id'),
    node_number: params.get('node_number') ?? '',
    tier: params.get('tier') ?? '',
    game_account_pseudo: params.get('game_account_pseudo') ?? '',
  };
}

function getInitialParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useKnowledgeBaseViewModel() {
  const pathname = usePathname();
  const requestIdRef = useRef(0);

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(getInitialParams()));
  const [planningErrorOnly, setPlanningErrorOnly] = useState<boolean | null>(() => {
    const v = getInitialParams().get('planning_error_only');
    return v === 'true' ? true : null;
  });
  const [debouncedPseudo, setDebouncedPseudo] = useState(
    () => getInitialParams().get('game_account_pseudo') ?? ''
  );
  const [page, setPage] = useState(() => Number(getInitialParams().get('page') ?? '1'));
  const [size, setSize] = useState(() => Number(getInitialParams().get('size') ?? '20'));
  const [sortBy, setSortBy] = useState(() => getInitialParams().get('sort_by') ?? 'created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    () => (getInitialParams().get('sort_order') as 'asc' | 'desc') ?? 'desc'
  );
  const [seasonSelector, setSeasonSelector] = useState<string>(
    () => getInitialParams().get('season_selector') ?? 'all_seasons'
  );
  const [seasonId, setSeasonId] = useState<string | null>(() =>
    getInitialParams().get('season_id')
  );
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [allianceId, setAllianceId] = useState<string | null>(() =>
    getInitialParams().get('alliance_id')
  );
  const [accessibleAlliances, setAccessibleAlliances] = useState<AccessibleAlliance[]>([]);
  const [data, setData] = useState<PaginatedFightRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPseudo(filters.game_account_pseudo), 300);
    return () => clearTimeout(timer);
  }, [filters.game_account_pseudo]);

  useEffect(() => {
    getSeasons()
      .then(setSeasons)
      .catch(() => setSeasons([]));
  }, []);

  useEffect(() => {
    getAccessibleAlliances()
      .then(setAccessibleAlliances)
      .catch(() => setAccessibleAlliances([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.champion_id) params.set('champion_id', filters.champion_id);
    if (filters.defender_champion_id)
      params.set('defender_champion_id', filters.defender_champion_id);
    if (filters.node_number) params.set('node_number', filters.node_number);
    if (filters.tier) params.set('tier', filters.tier);
    if (filters.game_account_pseudo) params.set('game_account_pseudo', filters.game_account_pseudo);
    if (planningErrorOnly !== null) params.set('planning_error_only', String(planningErrorOnly));
    if (seasonSelector !== 'all_seasons') params.set('season_selector', seasonSelector);
    if (seasonId) params.set('season_id', seasonId);
    if (allianceId) params.set('alliance_id', allianceId);
    if (page !== 1) params.set('page', String(page));
    if (size !== 20) params.set('size', String(size));
    if (sortBy !== 'created_at') params.set('sort_by', sortBy);
    if (sortOrder !== 'desc') params.set('sort_order', sortOrder);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  }, [
    filters,
    planningErrorOnly,
    seasonSelector,
    seasonId,
    allianceId,
    page,
    size,
    sortBy,
    sortOrder,
    pathname,
  ]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const apiFilters: FightRecordFilters = {
        champion_id: filters.champion_id ?? undefined,
        defender_champion_id: filters.defender_champion_id ?? undefined,
        node_number: filters.node_number ? Number.parseInt(filters.node_number) : undefined,
        tier: filters.tier ? Number.parseInt(filters.tier) : undefined,
        game_account_pseudo: debouncedPseudo || undefined,
        planning_error_only: planningErrorOnly ?? undefined,
        season_selector: seasonSelector,
        season_id: seasonId ?? undefined,
        alliance_id: allianceId ?? undefined,
        page,
        size,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const result = await getFightRecords(apiFilters);
      if (requestId === requestIdRef.current) setData(result);
    } catch {
      if (requestId === requestIdRef.current) setError('Failed to load fight records.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    filters.champion_id,
    filters.defender_champion_id,
    filters.node_number,
    filters.tier,
    debouncedPseudo,
    planningErrorOnly,
    seasonSelector,
    seasonId,
    allianceId,
    page,
    size,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleAllianceChange = (value: string | null) => {
    setAllianceId(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedPseudo('');
    setPlanningErrorOnly(null);
    setSeasonSelector('all_seasons');
    setSeasonId(null);
    setAllianceId(null);
    setPage(1);
  };

  const handleSeasonSelectorChange = (value: string) => {
    setSeasonSelector(value);
    if (value === 'specific') {
      setSeasonId(seasons[0]?.id ?? null);
    } else {
      setSeasonId(null);
    }
    setPage(1);
  };

  const handleSeasonIdChange = (value: string | null) => {
    setSeasonId(value);
    setPage(1);
  };

  const handleTogglePlanningError = () => {
    setPlanningErrorOnly((prev) => (prev === true ? null : true));
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    filters.champion_id ||
    filters.defender_champion_id ||
    filters.node_number ||
    filters.tier ||
    filters.game_account_pseudo ||
    planningErrorOnly !== null ||
    seasonSelector !== 'all_seasons' ||
    allianceId !== null
  );

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
    seasons,
    allianceId,
    accessibleAlliances,
    hasActiveFilters,
    handleFilterChange,
    handleTogglePlanningError,
    handleSeasonSelectorChange,
    handleSeasonIdChange,
    handleAllianceChange,
    handleSort,
    handleClearFilters,
    setPage,
    setSize,
  };
}

export type { FightRecord };
