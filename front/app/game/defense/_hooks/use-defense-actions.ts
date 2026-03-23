'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type DefenseSummary,
  type AvailableChampion,
  type BgMember,
  type DefenseImportReport,
  getDefense,
  placeDefender,
  removeDefender,
  clearDefense,
  getAvailableChampions,
  getBgMembers,
  exportDefense,
  importDefense,
} from '@/app/services/defense';

export function useDefenseActions(
  selectedAllianceId: string,
  selectedBg: number,
  selectedAllianceTag?: string
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
  const [importReport, setImportReport] = useState<DefenseImportReport | null>(null);
  const [importReportOpen, setImportReportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch (err: any) {
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
      setSelectorNode(null);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: any) {
      toast.error(err.message || t.game.defense.placeError);
    }
  };

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId) return;
    try {
      await removeDefender(selectedAllianceId, selectedBg, nodeNumber);
      toast.success(t.game.defense.removeSuccess);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: any) {
      toast.error(err.message || t.game.defense.removeError);
    }
  };

  const handleClearDefense = async () => {
    if (!selectedAllianceId) return;
    try {
      await clearDefense(selectedAllianceId, selectedBg);
      toast.success(t.game.defense.clearSuccess);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: any) {
      toast.error(err.message || t.game.defense.clearError);
    }
    setClearConfirmOpen(false);
  };

  // ─── Import / Export ───────────────────────────────────
  const handleExportDefense = async () => {
    if (!selectedAllianceId) return;
    try {
      const items = await exportDefense(selectedAllianceId, selectedBg);
      if (items.length === 0) {
        toast.warning(t.game.defense.importExport.emptyExport);
        return;
      }
      const json = JSON.stringify(items, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tag = selectedAllianceTag ?? 'defense';
      a.download = `defense_${tag}_bg${selectedBg}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        t.game.defense.importExport.exportedCount.replace('{count}', String(items.length))
      );
    } catch (err: any) {
      toast.error(err.message || t.game.defense.importExport.exportError);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAllianceId) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const placements = JSON.parse(text);
      if (!Array.isArray(placements) || placements.length === 0) {
        toast.error(t.game.defense.importExport.invalidFile);
        return;
      }
      const report = await importDefense(selectedAllianceId, selectedBg, placements);
      setImportReport(report);
      setImportReportOpen(true);
      await fetchDefense(true);
      resetPollTimer();
    } catch (err: any) {
      toast.error(err.message || t.game.defense.importExport.importError);
    }
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
    importReportOpen,
    setImportReportOpen,
    importReport,
    fileInputRef,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearDefense,
    handleExportDefense,
    handleImportFile,
  };
}
