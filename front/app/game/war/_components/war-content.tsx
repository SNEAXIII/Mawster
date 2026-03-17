'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Shield, Swords, Trash2, Flag } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import TabBar, { type TabItem } from '@/components/tab-bar';

import {
  type War,
  type WarDefenseSummary,
  type WarPlacement,
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

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
});

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => null,
});

const WarAttackerPanel = dynamic(() => import('./war-attacker-panel'), {
  loading: () => null,
});

const CreateWarDialog = dynamic(() => import('./create-war-dialog'), {
  loading: () => null,
});

export enum WarTab {
  Management = 'management',
  Defenders = 'defenders',
}

export enum WarMode {
  Defenders = 'defenders',
  Attackers = 'attackers',
}

export default function WarContent() {
  const { t } = useI18n();
  const { canManage } = useAllianceRole();

  useRequiredSession();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector();

  const [wars, setWars] = useState<War[]>([]);
  const [selectedWarId, setSelectedWarId] = useState('');

  const activeWarId = wars.find((w) => w.status === 'active')?.id ?? '';
  const [warLoading, setWarLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<WarTab>(WarTab.Management);

  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);

  const [warMode, setWarMode] = useState<WarMode>(WarMode.Attackers);
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndWarConfirm, setShowEndWarConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

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

  // Redirect non-officers away from management tab
  useEffect(() => {
    if (!loading && activeTab === WarTab.Management) {
      const alliance = alliances.find((a) => a.id === selectedAllianceId);
      if (alliance && !canManage(alliance)) {
        setActiveTab(WarTab.Defenders);
      }
    }
  }, [loading, selectedAllianceId, alliances, canManage]);

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

  const handleNodeClick = (nodeNumber: number) => {
    if (!activeWarId) return;
    if (warMode === WarMode.Attackers) {
      const hasDefender = placements.some((p) => p.node_number === nodeNumber);
      if (!hasDefender) {
        toast.warning(t.game.war.defenderRequired);
        return;
      }
      setAttackerSelectorNode(nodeNumber);
    } else {
      const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
      if (!selectedAlliance || !canManage(selectedAlliance)) return;
      setSelectorNode(nodeNumber);
    }
  };

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

  // ─── Render ──────────────────────────────────────────────

  if (loading) return <FullPageSpinner />;

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;
  const placements: WarPlacement[] = warSummary?.placements ?? [];
  const selectedWar = wars.find((w) => w.id === selectedWarId);
  const activeWar = wars.find((w) => w.id === activeWarId);
  const hasActiveWar = wars.some((w) => w.status === 'active');

  const tabs: TabItem<WarTab>[] = [
    ...(canManageWar
      ? [{ value: WarTab.Management, label: t.game.war.management, cy: 'tab-war-management' }]
      : []),
    { value: WarTab.Defenders, label: t.game.war.defenders, cy: 'tab-war-defenders' },
  ];

  return (
    <div className='w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      {alliances.length === 0 ? (
        <p className='text-muted-foreground'>{t.game.war.noAlliance}</p>
      ) : (
        <>
          {/* Alliance selector — hidden when only one alliance */}
          {alliances.length > 1 && (
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
          )}

          {/* Tabs */}
          <TabBar
            tabs={tabs}
            value={activeTab}
            onChange={setActiveTab}
          />

          {/* ── Management tab ──────────────────────────── */}
          {activeTab === WarTab.Management && (
            <div className='space-y-4'>
              {/* War selector + actions */}
              <div className='flex flex-wrap items-center gap-3'>
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
                        vs {w.opponent_name}{w.status === 'ended' ? ' ✓' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {canManageWar && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant='default'
                            onClick={() => setShowCreateDialog(true)}
                            disabled={hasActiveWar}
                            data-cy='declare-war-btn'
                          >
                            <Swords className='w-4 h-4 mr-2' />
                            {t.game.war.declareWar}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {hasActiveWar && (
                        <TooltipContent>
                          {t.game.war.declareWarTooltip}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}

                {canManageWar && selectedWar?.status === 'active' && (
                  <Button
                    variant='destructive'
                    onClick={() => setShowEndWarConfirm(true)}
                    data-cy='end-war-btn'
                  >
                    <Flag className='w-4 h-4 mr-2' />
                    {t.game.war.endWar}
                  </Button>
                )}
              </div>

              {wars.length === 0 && (
                <p className='text-muted-foreground'>{t.game.war.noWar}</p>
              )}

              {selectedWar && (
                <div className='text-sm text-muted-foreground'>
                  vs <span className='font-semibold text-foreground'>{selectedWar.opponent_name}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Defenders tab ────────────────────────────── */}
          {activeTab === WarTab.Defenders && (
            <>
              {!activeWarId ? (
                <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
              ) : (
                <div className='space-y-4'>
                  {/* Controls row: opponent name + BG picker + mode toggle + clear */}
                  <div className='flex flex-wrap items-center gap-3'>
                    {/* Opponent name */}
                    {activeWar && (
                      <div className='flex items-center gap-2'>
                        <Swords className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm font-semibold'>vs {activeWar.opponent_name}</span>
                      </div>
                    )}

                    {/* BG button group */}
                    <div
                      className='flex gap-1 rounded-md border p-1'
                      data-cy='bg-picker'
                    >
                      {[1, 2, 3].map((bg) => (
                        <button
                          key={bg}
                          onClick={() => setSelectedBg(bg)}
                          className={cn(
                            'px-3 py-1 rounded text-sm font-semibold transition-colors',
                            selectedBg === bg
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent'
                          )}
                          data-cy={`bg-btn-${bg}`}
                        >
                          G{bg}
                        </button>
                      ))}
                    </div>

                    {/* Mode toggle — visible to all */}
                    {true && (
                      <div className='flex gap-1 rounded-md border p-1' data-cy='war-mode-toggle'>
                        <button
                          onClick={() => setWarMode(WarMode.Defenders)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
                            warMode === WarMode.Defenders
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent'
                          )}
                          data-cy='war-mode-defenders'
                        >
                          <Shield className='w-3.5 h-3.5' />
                          {t.game.war.modeDefenders}
                        </button>
                        <button
                          onClick={() => setWarMode(WarMode.Attackers)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
                            warMode === WarMode.Attackers
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent'
                          )}
                          data-cy='war-mode-attackers'
                        >
                          <Swords className='w-3.5 h-3.5' />
                          {t.game.war.modeAttackers}
                        </button>
                      </div>
                    )}

                    {/* Clear BG button */}
                    {canManageWar && placements.length > 0 && (
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

                  {warLoading ? (
                    <FullPageSpinner />
                  ) : (
                    <div className='flex gap-4'>
                      <div className='overflow-x-auto flex-1'>
                        <WarDefenseMap
                          placements={placements}
                          onNodeClick={handleNodeClick}
                          onRemove={handleRemoveDefender}
                          canManage={canManageWar && warMode === WarMode.Defenders}
                        />
                      </div>
                      {warMode === WarMode.Attackers && (
                        <div className='w-64 flex-shrink-0'>
                          <WarAttackerPanel
                            placements={placements}
                            onRemoveAttacker={handleRemoveAttacker}
                            onUpdateKo={handleUpdateKo}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Defender champion selector */}
      <WarChampionSelector
        open={selectorNode !== null}
        onClose={() => setSelectorNode(null)}
        nodeNumber={selectorNode ?? 0}
        placedChampionIds={new Set(placements.map((p) => p.champion_id))}
        onSelect={handlePlaceDefender}
      />

      {/* Attacker selector */}
      <WarAttackerSelector
        open={attackerSelectorNode !== null}
        onClose={() => setAttackerSelectorNode(null)}
        nodeNumber={attackerSelectorNode ?? 0}
        allianceId={selectedAllianceId}
        warId={activeWarId}
        battlegroup={selectedBg}
        placements={placements}
        onSelect={handleAssignAttacker}
      />

      {/* Create war dialog */}
      <CreateWarDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateWar}
      />

      {/* End war confirm dialog */}
      <ConfirmationDialog
        open={showEndWarConfirm}
        onOpenChange={setShowEndWarConfirm}
        onConfirm={async () => {
          setShowEndWarConfirm(false);
          await handleEndWar();
        }}
        title={t.game.war.endWarConfirmTitle}
        description={t.game.war.endWarConfirmDesc}
        variant='destructive'
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
