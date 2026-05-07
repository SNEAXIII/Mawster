'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  getFightRecords,
  type FightRecord,
  type PaginatedFightRecords,
  type FightRecordFilters,
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
  const router = useRouter();
  const pathname = usePathname();

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(getInitialParams()));
  const [planningErrorOnly, setPlanningErrorOnly] = useState<boolean | null>(() => {
    const v = getInitialParams().get('planning_error_only');
    return v === 'true' ? true : null;
  });
  const [debouncedPseudo, setDebouncedPseudo] = useState(() => getInitialParams().get('game_account_pseudo') ?? '');
  const [page, setPage] = useState(() => Number(getInitialParams().get('page') ?? '1'));
  const [size, setSize] = useState(() => Number(getInitialParams().get('size') ?? '20'));
  const [sortBy, setSortBy] = useState(() => getInitialParams().get('sort_by') ?? 'created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => (getInitialParams().get('sort_order') as 'asc' | 'desc') ?? 'desc');
  const [data, setData] = useState<PaginatedFightRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPseudo(filters.game_account_pseudo), 300);
    return () => clearTimeout(timer);
  }, [filters.game_account_pseudo]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.champion_id) params.set('champion_id', filters.champion_id);
    if (filters.defender_champion_id) params.set('defender_champion_id', filters.defender_champion_id);
    if (filters.node_number) params.set('node_number', filters.node_number);
    if (filters.tier) params.set('tier', filters.tier);
    if (filters.game_account_pseudo) params.set('game_account_pseudo', filters.game_account_pseudo);
    if (planningErrorOnly !== null) params.set('planning_error_only', String(planningErrorOnly));
    if (page !== 1) params.set('page', String(page));
    if (size !== 20) params.set('size', String(size));
    if (sortBy !== 'created_at') params.set('sort_by', sortBy);
    if (sortOrder !== 'desc') params.set('sort_order', sortOrder);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, planningErrorOnly, page, size, sortBy, sortOrder, pathname, router]);

  const load = useCallback(async () => {
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
        page,
        size,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      setData(await getFightRecords(apiFilters));
    } catch {
      setError('Failed to load fight records.');
    } finally {
      setLoading(false);
    }
  }, [filters.champion_id, filters.defender_champion_id, filters.node_number, filters.tier, debouncedPseudo, planningErrorOnly, page, size, sortBy, sortOrder]);

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

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedPseudo('');
    setPlanningErrorOnly(null);
    setPage(1);
  };

  const handleTogglePlanningError = () => {
    setPlanningErrorOnly((prev) => (prev === true ? null : true));
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    filters.champion_id || filters.defender_champion_id ||
    filters.node_number || filters.tier || filters.game_account_pseudo ||
    planningErrorOnly !== null
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
    hasActiveFilters,
    handleFilterChange,
    handleTogglePlanningError,
    handleSort,
    handleClearFilters,
    setPage,
    setSize,
  };
}

export type { FightRecord };
