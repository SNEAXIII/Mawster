'use client';
import { useState, useEffect, useCallback } from 'react';
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
  battlegroup: string;
}

const DEFAULT_FILTERS: Filters = {
  champion_id: null,
  defender_champion_id: null,
  node_number: '',
  tier: '',
  battlegroup: '',
};

export function useKnowledgeBaseViewModel() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [data, setData] = useState<PaginatedFightRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiFilters: FightRecordFilters = {
        champion_id: filters.champion_id ?? undefined,
        defender_champion_id: filters.defender_champion_id ?? undefined,
        node_number: filters.node_number ? Number.parseInt(filters.node_number) : undefined,
        tier: filters.tier ? Number.parseInt(filters.tier) : undefined,
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
  }, [filters, page, size, sortBy, sortOrder]);

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
    setPage(1);
  };

  return {
    filters,
    data,
    loading,
    error,
    page,
    size,
    sortBy,
    sortOrder,
    handleFilterChange,
    handleSort,
    handleClearFilters,
    setPage,
    setSize,
  };
}

export type { FightRecord };
