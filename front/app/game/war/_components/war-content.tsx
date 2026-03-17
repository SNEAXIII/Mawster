'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Swords, Trash2, Flag } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import TabBar, { type TabItem } from '@/components/tab-bar';
import { type WarPlacement } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { toast } from 'sonner';

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
  const { canManage, loading: roleLoading } = useAllianceRole();

  useRequiredSession();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector();

  const {
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
  } = useWarActions(selectedAllianceId, selectedBg);

  const [activeTab, setActiveTab] = useState<WarTab>(WarTab.Management);
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Defenders);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

  // Redirect non-officers away from management tab
  useEffect(() => {
    if (!loading && !roleLoading && activeTab === WarTab.Management) {
      const alliance = alliances.find((a) => a.id === selectedAllianceId);
      if (alliance && !canManage(alliance)) {
        setActiveTab(WarTab.Defenders);
      }
    }
  }, [loading, roleLoading, selectedAllianceId, alliances, canManage, activeTab]);

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
                        vs {w.opponent_name}
                        {w.status === 'ended' ? ' ✓' : ''}
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
                        <TooltipContent>{t.game.war.declareWarTooltip}</TooltipContent>
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

              {wars.length === 0 && <p className='text-muted-foreground'>{t.game.war.noWar}</p>}

              {selectedWar && (
                <div className='text-sm text-muted-foreground'>
                  vs{' '}
                  <span className='font-semibold text-foreground'>{selectedWar.opponent_name}</span>
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

                    {/* Mode toggle — visible to officers/managers only */}
                    {canManageWar && (
                      <div
                        className='flex gap-1 rounded-md border p-1'
                        data-cy='war-mode-toggle'
                      >
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
