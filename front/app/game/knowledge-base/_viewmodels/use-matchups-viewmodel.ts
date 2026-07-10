'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { getMyAllianceRoles, type AllianceMyRoles } from '@/app/services/game';
import {
  deleteMatchup,
  evaluateMatchups,
  getMatchups,
  upsertMatchup,
  type MatchupEvaluationRow,
  type MatchupRating,
  type MatchupUpsertBody,
} from '@/app/services/matchups';

export interface MatchupFiltersState {
  championId: string | null;
  defenderChampionId: string | null;
  nodeNumber: string;
  gameAccountId: string;
}

const EMPTY_FILTERS: MatchupFiltersState = {
  championId: null,
  defenderChampionId: null,
  nodeNumber: '',
  gameAccountId: '',
};

export function useMatchupsViewModel() {
  const { alliances, selectedAllianceId, setSelectedAllianceId, loading: alliancesLoading } =
    useAllianceSelector();
  const [filters, setFilters] = useState<MatchupFiltersState>(EMPTY_FILTERS);
  const [rows, setRows] = useState<MatchupEvaluationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTarget = filters.defenderChampionId !== null || filters.nodeNumber !== '';

  const reload = useCallback(async () => {
    if (!selectedAllianceId || !hasTarget) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await evaluateMatchups(selectedAllianceId, {
        champion_id: filters.championId,
        defender_champion_id: filters.defenderChampionId,
        node_number: filters.nodeNumber === '' ? null : Number(filters.nodeNumber),
        game_account_id: filters.gameAccountId || null,
      });
      setRows(result);
    } catch {
      setError('load-failed');
    } finally {
      setLoading(false);
    }
  }, [selectedAllianceId, hasTarget, filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setFilter = useCallback(
    <K extends keyof MatchupFiltersState>(key: K, value: MatchupFiltersState[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    []
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const [ratings, setRatings] = useState<MatchupRating[]>([]);

  const loadRatings = useCallback(async () => {
    if (!selectedAllianceId) {
      setRatings([]);
      return;
    }
    try {
      setRatings(await getMatchups(selectedAllianceId));
    } catch {
      setError('load-failed');
    }
  }, [selectedAllianceId]);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const saveMatchup = useCallback(
    async (body: MatchupUpsertBody) => {
      if (!selectedAllianceId) return;
      await upsertMatchup(selectedAllianceId, body);
      await Promise.all([loadRatings(), reload()]);
    },
    [selectedAllianceId, loadRatings, reload]
  );

  const removeMatchup = useCallback(
    async (ratingId: string) => {
      if (!selectedAllianceId) return;
      await deleteMatchup(selectedAllianceId, ratingId);
      await Promise.all([loadRatings(), reload()]);
    },
    [selectedAllianceId, loadRatings, reload]
  );

  const [roles, setRoles] = useState<AllianceMyRoles['roles']>({});
  useEffect(() => {
    getMyAllianceRoles()
      .then((result) => setRoles(result.roles))
      .catch(() => setRoles({}));
  }, []);

  // Only officers and the owner may write. A plain member reads like everyone else, so
  // showing them a form that the API answers with 403 would be a lie.
  const canEdit = Boolean(selectedAllianceId && roles[selectedAllianceId]?.can_manage);

  return {
    alliances,
    allianceId: selectedAllianceId,
    setAllianceId: setSelectedAllianceId,
    alliancesLoading,
    filters,
    setFilter,
    clearFilters,
    hasTarget,
    rows,
    loading,
    error,
    reload,
    canEdit,
    ratings,
    saveMatchup,
    removeMatchup,
  };
}
