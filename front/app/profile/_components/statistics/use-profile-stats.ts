'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMyGameAccounts, type GameAccount } from '@/app/services/game';
import {
  getPlayerSeasons,
  getPlayerStats,
  getPlayerChampionUsage,
  type PlayerStats,
  type PlayerSeasonOption,
} from '@/app/services/player-stats';
import type { ChampionUsageItem } from '@/app/services/statistics';

type Metric = 'all' | 'kos' | 'deathless';

export function useProfileStats() {
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [seasons, setSeasons] = useState<PlayerSeasonOption[]>([]);
  const [seasonId, setSeasonId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [usage, setUsage] = useState<ChampionUsageItem[]>([]);
  const [metric, setMetric] = useState<Metric>('all');
  const [perspective, setPerspective] = useState<'attacker' | 'defender'>('attacker');
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyGameAccounts()
      .then((a) => {
        setAccounts(a);
        setAccountId(a[0]?.id ?? '');
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, []);

  useEffect(() => {
    if (!accountId) return;
    getPlayerSeasons(accountId)
      .then((s) => {
        setSeasons(s);
        setSeasonId(s[0]?.season_id);
      })
      .catch(() => {
        setSeasons([]);
        setSeasonId(undefined);
      });
  }, [accountId]);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const [st, us] = await Promise.all([
        getPlayerStats(accountId, seasonId),
        getPlayerChampionUsage(accountId, seasonId, metric === 'deathless', perspective),
      ]);
      setStats(st);
      setUsage(us);
    } catch {
      setError('error');
    } finally {
      setLoading(false);
    }
  }, [accountId, seasonId, metric, perspective]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    accounts,
    accountsLoading,
    accountId,
    setAccountId,
    seasons,
    seasonId,
    setSeasonId,
    stats,
    usage,
    metric,
    setMetric,
    perspective,
    setPerspective,
    detailOpen,
    setDetailOpen,
    loading,
    error,
    retry: load,
  };
}
