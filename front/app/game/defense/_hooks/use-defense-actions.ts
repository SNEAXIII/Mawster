'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type DefenseSummary,
  type AvailableChampion,
  type BgMember,
  getDefense,
  placeDefender,
  removeDefender,
  clearDefense,
  getAvailableChampions,
  getBgMembers,
} from '@/app/services/defense';

export function useDefenseActions(
  selectedAllianceId: string,
  selectedBg: number,
) {
  const { t } = useI18n();

  // State
  const [defenseLoading, setDefenseLoading] = useState(false);

  // Defense data
  const [defenseSummary, setDefenseSummary] = useState<DefenseSummary | null>(null);
  const [availableChampions, setAvailableChampions] = useState<AvailableChampion[]>([]);
  const [bgMembers, setBgMembers] = useState<BgMember[]>([]);

  // Dialogs
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // ─── Data fetching ─────────────────────────────────────
  const fetchDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId) return;
      if (!silent) setDefenseLoading(true);
      try {
        const [defense, champions, members] = await Promise.all([
          getDefense(selectedAllianceId, selectedBg),
          getAvailableChampions(selectedAllianceId, selectedBg),
          getBgMembers(selectedAllianceId, selectedBg),
        ]);
        setDefenseSummary(defense);
        setAvailableChampions(champions);
        setBgMembers(members);
      } catch {
        if (!silent) toast.error(t.game.defense.loadError);
      } finally {
        if (!silent) setDefenseLoading(false);
      }
    },
    [selectedAllianceId, selectedBg, t]
  );

  const fetchDefenseRef = useRef(fetchDefense);
  useEffect(() => {
    fetchDefenseRef.current = fetchDefense;
  }, [fetchDefense]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetPollTimer = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => fetchDefenseRef.current(true), 10_000);
  }, []);

  useEffect(() => {
    if (selectedAllianceId) {
      fetchDefense();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAllianceId, selectedBg]);

  useEffect(() => {
    if (!selectedAllianceId) return;
    resetPollTimer();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedAllianceId, selectedBg, resetPollTimer]);

  // ─── Actions ───────────────────────────────────────────
  const handlePlaceDefender = async (
    championUserId: string,
    gameAccountId: string,
    championName: string
  ) => {
    if (!selectedAllianceId || selectorNode === null) return;
    try {
      await placeDefender(
        selectedAllianceId,
        selectedBg,
        selectorNode,
        championUserId,
        gameAccountId
      );
      toast.success(
        t.game.defense.placeSuccess
          .replace('{name}', championName)
          .replace('{node}', String(selectorNode))
      );
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.placeError);
    }
  };

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId) return;
    try {
      await removeDefender(selectedAllianceId, selectedBg, nodeNumber);
      toast.success(t.game.defense.removeSuccess);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.removeError);
    }
  };

  const handleClearDefense = async () => {
    if (!selectedAllianceId) return;
    try {
      await clearDefense(selectedAllianceId, selectedBg);
      toast.success(t.game.defense.clearSuccess);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.clearError);
    }
    setClearConfirmOpen(false);
  };

  return {
    defenseSummary,
    availableChampions,
    bgMembers,
    defenseLoading,
    selectorNode,
    setSelectorNode,
    clearConfirmOpen,
    setClearConfirmOpen,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearDefense,
  };
}
