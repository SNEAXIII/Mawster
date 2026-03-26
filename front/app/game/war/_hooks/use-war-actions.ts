'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type WarDefenseSummary,
  type AvailableAttacker,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
  assignWarAttacker,
  removeWarAttacker,
  updateWarKo,
} from '@/app/services/war';

export function useWarActions(
  selectedAllianceId: string,
  selectedBg: number,
  activeWarId: string,
) {
  const { t } = useI18n();

  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingRemoveNode, setPendingRemoveNode] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // ─── Fetch war defense ───────────────────────────────────
  const fetchWarDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId || !activeWarId) return;
      if (!silent) setWarLoading(true);
      try {
        const summary = await getWarDefense(selectedAllianceId, activeWarId, selectedBg);
        setWarSummary(summary);
      } catch {
        if (!silent) toast.error(tRef.current.game.war.loadError);
      } finally {
        if (!silent) setWarLoading(false);
      }
    },
    [selectedAllianceId, activeWarId, selectedBg]
  );

  useEffect(() => {
    setWarSummary(null);
    if (activeWarId) {
      fetchWarDefense();
    }
  }, [activeWarId, selectedBg, fetchWarDefense]);

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

  const handleRemoveDefender = (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    const placement = warSummary?.placements.find((p) => p.node_number === nodeNumber);
    if (placement?.attacker_champion_user_id) {
      setPendingRemoveNode(nodeNumber);
      return;
    }
    void doRemoveDefender(nodeNumber);
  };

  const doRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarDefender(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeSuccess);
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeError);
    }
  };

  const handleConfirmRemoveDefender = async () => {
    if (pendingRemoveNode === null) return;
    const node = pendingRemoveNode;
    setPendingRemoveNode(null);
    await doRemoveDefender(node);
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

  const handleAssignAttacker = async (attacker: AvailableAttacker) => {
    if (!selectedAllianceId || !activeWarId || attackerSelectorNode === null) return;
    const nodeNumber = attackerSelectorNode;
    try {
      await assignWarAttacker(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber,
        attacker.champion_user_id
      );
      toast.success(
        t.game.war.assignSuccess
          .replace('{name}', attacker.champion_name)
          .replace('{node}', String(nodeNumber))
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === nodeNumber
                  ? {
                      ...p,
                      attacker_champion_user_id: attacker.champion_user_id,
                      attacker_pseudo: attacker.game_pseudo,
                      attacker_champion_name: attacker.champion_name,
                      attacker_champion_class: attacker.champion_class,
                      attacker_image_url: attacker.image_url,
                      attacker_rarity: attacker.rarity,
                    }
                  : p
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

  return {
    warSummary,
    warLoading,
    selectorNode,
    setSelectorNode,
    attackerSelectorNode,
    setAttackerSelectorNode,
    showClearConfirm,
    setShowClearConfirm,
    pendingRemoveNode,
    setPendingRemoveNode,
    handleConfirmRemoveDefender,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearBg,
    handleAssignAttacker,
    handleRemoveAttacker,
    handleUpdateKo,
  };
}
