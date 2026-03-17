'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type War,
  type WarDefenseSummary,
  getWars,
  createWar,
  endWar,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
  assignWarAttacker,
  removeWarAttacker,
  updateWarKo,
} from '@/app/services/war';

export function useWarActions(selectedAllianceId: string, selectedBg: number) {
  const { t } = useI18n();

  const [wars, setWars] = useState<War[]>([]);
  const [selectedWarId, setSelectedWarId] = useState('');
  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndWarConfirm, setShowEndWarConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeWarId = wars.find((w) => w.status === 'active')?.id ?? '';

  // ─── Fetch wars ──────────────────────────────────────────
  const fetchWars = useCallback(
    async (allianceId: string) => {
      if (!allianceId) return;
      try {
        const data = await getWars(allianceId);
        setWars(data);
        if (data.length > 0 && !selectedWarId) {
          setSelectedWarId(data[0].id);
        }
      } catch {
        toast.error(t.game.war.loadError);
      }
    },
    [t, selectedWarId]
  );

  // ─── Fetch war defense ───────────────────────────────────
  const fetchWarDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId || !activeWarId) return;
      if (!silent) setWarLoading(true);
      try {
        const summary = await getWarDefense(selectedAllianceId, activeWarId, selectedBg);
        setWarSummary(summary);
      } catch {
        if (!silent) toast.error(t.game.war.loadError);
      } finally {
        if (!silent) setWarLoading(false);
      }
    },
    [selectedAllianceId, activeWarId, selectedBg, t]
  );

  useEffect(() => {
    if (selectedAllianceId) {
      setSelectedWarId('');
      setWars([]);
      fetchWars(selectedAllianceId);
    }
  }, [selectedAllianceId]);

  useEffect(() => {
    setWarSummary(null);
    if (activeWarId) {
      fetchWarDefense();
    }
  }, [activeWarId, selectedBg]);

  // Polling every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeWarId) {
      pollRef.current = setInterval(() => fetchWarDefense(true), 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWarDefense, activeWarId]);

  // ─── Actions ─────────────────────────────────────────────

  const handlePlaceDefender = async (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => {
    if (!selectedAllianceId || !activeWarId || selectorNode === null) return;
    try {
      await placeWarDefender(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        selectorNode,
        championId,
        stars,
        rank,
        ascension
      );
      toast.success(
        t.game.war.placeSuccess
          .replace('{name}', championName)
          .replace('{node}', String(selectorNode))
      );
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.placeError);
    }
  };

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarDefender(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeSuccess);
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeError);
    }
  };

  const handleClearBg = async () => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await clearWarBg(selectedAllianceId, activeWarId, selectedBg);
      toast.success(t.game.war.clearSuccess);
      await fetchWarDefense();
    } catch {
      toast.error(t.game.war.loadError);
    }
  };

  const handleAssignAttacker = async (
    championUserId: string,
    pseudo: string,
    championName: string
  ) => {
    if (!selectedAllianceId || !activeWarId || attackerSelectorNode === null) return;
    try {
      const updated = await assignWarAttacker(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        attackerSelectorNode,
        championUserId
      );
      toast.success(
        t.game.war.assignSuccess
          .replace('{name}', championName)
          .replace('{node}', String(attackerSelectorNode))
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.assignError);
    }
  };

  const handleRemoveAttacker = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await removeWarAttacker(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeAttackerSuccess);
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeAttackerError);
    }
  };

  const handleUpdateKo = async (nodeNumber: number, newKo: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await updateWarKo(selectedAllianceId, activeWarId, selectedBg, nodeNumber, newKo);
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.koUpdateError);
    }
  };

  const handleCreateWar = async (opponentName: string) => {
    if (!selectedAllianceId) return;
    try {
      const war = await createWar(selectedAllianceId, opponentName);
      toast.success(t.game.war.createSuccess.replace('{name}', opponentName));
      setWars((prev) => [war, ...prev]);
      setSelectedWarId(war.id);
    } catch (err: any) {
      toast.error(err.message || t.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async () => {
    if (!selectedAllianceId || !selectedWarId) return;
    try {
      const updated = await endWar(selectedAllianceId, selectedWarId);
      toast.success(t.game.war.endWarSuccess);
      setWars((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err: any) {
      toast.error(err.message || t.game.war.endWarError);
    }
  };

  return {
    wars,
    selectedWarId,
    setSelectedWarId,
    warSummary,
    warLoading,
    selectorNode,
    setSelectorNode,
    attackerSelectorNode,
    setAttackerSelectorNode,
    showCreateDialog,
    setShowCreateDialog,
    showClearConfirm,
    setShowClearConfirm,
    showEndWarConfirm,
    setShowEndWarConfirm,
    activeWarId,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearBg,
    handleAssignAttacker,
    handleRemoveAttacker,
    handleCreateWar,
    handleEndWar,
    handleUpdateKo,
  };
}
