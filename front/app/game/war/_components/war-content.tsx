'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Swords, Trash2 } from 'lucide-react';

import { type Alliance, getMyAlliances } from '@/app/services/game';
import {
  type War,
  type WarDefenseSummary,
  type WarPlacement,
  getWars,
  createWar,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
} from '@/app/services/war';

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
});

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarSidePanel = dynamic(() => import('./war-side-panel'), {
  loading: () => <FullPageSpinner />,
});

const CreateWarDialog = dynamic(() => import('./create-war-dialog'), {
  loading: () => null,
});

export default function WarContent() {
  const { t } = useI18n();
  const { canManage } = useAllianceRole();

  useRequiredSession();

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState('');
  const [wars, setWars] = useState<War[]>([]);
  const [selectedWarId, setSelectedWarId] = useState('');
  const [selectedBg, setSelectedBg] = useState(1);
  const [loading, setLoading] = useState(true);
  const [warLoading, setWarLoading] = useState(false);

  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);

  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch alliances ─────────────────────────────────────
  const fetchAlliances = useCallback(async () => {
    try {
      const data = await getMyAlliances();
      setAlliances(data);
      if (data.length > 0 && !selectedAllianceId) {
        setSelectedAllianceId(data[0].id);
      }
    } catch {
      toast.error(t.game.war.loadError);
    } finally {
      setLoading(false);
    }
  }, [t, selectedAllianceId]);

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
      if (!selectedAllianceId || !selectedWarId) return;
      if (!silent) setWarLoading(true);
      try {
        const summary = await getWarDefense(selectedAllianceId, selectedWarId, selectedBg);
        setWarSummary(summary);
      } catch {
        if (!silent) toast.error(t.game.war.loadError);
      } finally {
        if (!silent) setWarLoading(false);
      }
    },
    [selectedAllianceId, selectedWarId, selectedBg, t]
  );

  useEffect(() => {
    fetchAlliances();
  }, []);

  useEffect(() => {
    if (selectedAllianceId) {
      setSelectedWarId('');
      setWars([]);
      fetchWars(selectedAllianceId);
    }
  }, [selectedAllianceId]);

  useEffect(() => {
    setWarSummary(null);
    if (selectedWarId) {
      fetchWarDefense();
    }
  }, [selectedWarId, selectedBg]);

  // Polling every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedWarId) {
      pollRef.current = setInterval(() => fetchWarDefense(true), 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWarDefense, selectedWarId]);

  // ─── Actions ─────────────────────────────────────────────

  const handleNodeClick = (nodeNumber: number) => {
    const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
    if (!selectedAlliance || !canManage(selectedAlliance)) return;
    setSelectorNode(nodeNumber);
  };

  const handlePlaceDefender = async (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => {
    if (!selectedAllianceId || !selectedWarId || selectorNode === null) return;
    try {
      await placeWarDefender(
        selectedAllianceId,
        selectedWarId,
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
    if (!selectedAllianceId || !selectedWarId) return;
    try {
      await removeWarDefender(selectedAllianceId, selectedWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeSuccess);
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeError);
    }
  };

  const handleClearBg = async () => {
    if (!selectedAllianceId || !selectedWarId) return;
    try {
      await clearWarBg(selectedAllianceId, selectedWarId, selectedBg);
      toast.success(t.game.war.clearSuccess);
      await fetchWarDefense();
    } catch {
      toast.error(t.game.war.loadError);
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

  // ─── Render ──────────────────────────────────────────────

  if (loading) return <FullPageSpinner />;

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;
  const placements: WarPlacement[] = warSummary?.placements ?? [];

  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold flex items-center gap-2'>
          <Swords className='w-6 h-6' />
          {t.game.war.title}
        </h1>
        <p className='text-muted-foreground text-sm'>{t.game.war.description}</p>
      </div>

      {alliances.length === 0 ? (
        <p className='text-muted-foreground'>{t.game.war.noAlliance}</p>
      ) : (
        <>
          {/* Controls */}
          <div className='flex flex-wrap items-center gap-3'>
            {/* Alliance selector */}
            <Select
              value={selectedAllianceId}
              onValueChange={setSelectedAllianceId}
            >
              <SelectTrigger
                className='w-48'
                data-cy='alliance-select'
              >
                <SelectValue placeholder={t.game.defense.alliance} />
              </SelectTrigger>
              <SelectContent>
                {alliances.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={a.id}
                  >
                    [{a.tag}] {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* War selector */}
            <Select
              value={selectedWarId}
              onValueChange={setSelectedWarId}
            >
              <SelectTrigger
                className='w-56'
                data-cy='war-select'
              >
                <SelectValue placeholder={t.game.war.selectWar} />
              </SelectTrigger>
              <SelectContent>
                {wars.map((w) => (
                  <SelectItem
                    key={w.id}
                    value={w.id}
                    data-cy={`war-option-${w.id}`}
                  >
                    vs {w.opponent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* BG selector */}
            <Select
              value={String(selectedBg)}
              onValueChange={(v) => setSelectedBg(Number(v))}
            >
              <SelectTrigger
                className='w-36'
                data-cy='bg-select'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map((bg) => (
                  <SelectItem
                    key={bg}
                    value={String(bg)}
                    data-cy={`bg-option-${bg}`}
                  >
                    {t.game.defense.battlegroup} {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Declare war button (officers only) */}
            {canManageWar && (
              <Button
                variant='default'
                onClick={() => setShowCreateDialog(true)}
                data-cy='declare-war-btn'
              >
                <Swords className='w-4 h-4 mr-2' />
                {t.game.war.declareWar}
              </Button>
            )}

            {/* Clear BG button */}
            {canManageWar && selectedWarId && placements.length > 0 && (
              <Button
                variant='outline'
                onClick={() => setShowClearConfirm(true)}
                data-cy='clear-war-bg-btn'
              >
                <Trash2 className='w-4 h-4 mr-2' />
                {t.game.war.clearAll}
              </Button>
            )}
          </div>

          {wars.length === 0 ? (
            <p className='text-muted-foreground'>{t.game.war.noWar}</p>
          ) : !selectedWarId ? (
            <p className='text-muted-foreground'>{t.game.war.selectWar}</p>
          ) : warLoading ? (
            <FullPageSpinner />
          ) : (
            <div className='flex flex-col lg:flex-row gap-4'>
              {/* Map */}
              <div className='flex-1 overflow-x-auto'>
                <WarDefenseMap
                  placements={placements}
                  onNodeClick={handleNodeClick}
                  onRemove={handleRemoveDefender}
                  canManage={canManageWar}
                />
              </div>

              {/* Side panel */}
              <div className='lg:w-64 shrink-0'>
                <WarSidePanel
                  placements={placements}
                  onRemoveDefender={handleRemoveDefender}
                  canManage={canManageWar}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Champion selector */}
      <WarChampionSelector
        open={selectorNode !== null}
        onClose={() => setSelectorNode(null)}
        nodeNumber={selectorNode ?? 0}
        placedChampionIds={new Set(placements.map((p) => p.champion_id))}
        onSelect={handlePlaceDefender}
      />

      {/* Create war dialog */}
      <CreateWarDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateWar}
      />

      {/* Clear confirm dialog */}
      <ConfirmationDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        onConfirm={async () => {
          setShowClearConfirm(false);
          await handleClearBg();
        }}
        title={t.game.war.clearConfirmTitle}
        description={t.game.war.clearConfirmDesc}
        variant='destructive'
      />
    </div>
  );
}
