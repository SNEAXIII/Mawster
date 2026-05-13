'use client';

import { useEffect, useState } from 'react';
import { getChampionUsage, type ChampionUsageItem } from '@/app/services/statistics';
import { getWars, type War } from '@/app/services/war';

export function useChampionStats(allianceId: string, selectedGroup = 'all') {
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<string | null>(null);
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null);
  const [championUsage, setChampionUsage] = useState<ChampionUsageItem[]>([]);
  const [chartMetric, setChartMetric] = useState<'all' | 'kos' | 'deathless'>('deathless');
  const [detailOpen, setDetailOpen] = useState(false);
  const [wars, setWars] = useState<War[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (!allianceId) return;
    getWars(allianceId)
      .then((all) => setWars(all.filter((w) => w.season_id !== null && w.status === 'ended')))
      .catch(console.error);
  }, [allianceId]);

  useEffect(() => {
    if (!allianceId) return;
    setChartLoading(true);
    const groupNum = selectedGroup !== 'all' && selectedGroup !== 'none' ? Number(selectedGroup) : undefined;
    getChampionUsage(
      allianceId,
      selectedGameAccountId ?? undefined,
      selectedWarId ?? undefined,
      groupNum,
      chartMetric === 'deathless',
    )
      .then(setChampionUsage)
      .catch(console.error)
      .finally(() => setChartLoading(false));
  }, [allianceId, selectedGameAccountId, selectedWarId, selectedGroup, chartMetric]);

  const handleRowClick = (gameAccountId: string) => {
    setSelectedGameAccountId((prev) => (prev === gameAccountId ? null : gameAccountId));
  };

  return {
    selectedGameAccountId,
    setSelectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage,
    chartMetric,
    setChartMetric,
    detailOpen,
    setDetailOpen,
    wars,
    chartLoading,
    handleRowClick,
  };
}
