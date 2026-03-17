'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import TabBar, { type TabItem } from '@/components/tab-bar';
import { type WarPlacement } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { toast } from 'sonner';
import { WarTab, WarMode } from './war-types';
import WarHeader from './war-header';
import WarManagementTab from './war-management-tab';
import WarDefendersTab from './war-defenders-tab';

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => null,
});

const CreateWarDialog = dynamic(() => import('./create-war-dialog'), {
  loading: () => null,
});

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
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Attackers);

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
          <WarHeader
            alliances={alliances}
            selectedAllianceId={selectedAllianceId}
            onAllianceChange={setSelectedAllianceId}
          />

          {/* Tabs */}
          <TabBar
            tabs={tabs}
            value={activeTab}
            onChange={setActiveTab}
          />

          {/* ── Management tab ──────────────────────────── */}
          {activeTab === WarTab.Management && (
            <WarManagementTab
              wars={wars}
              selectedWarId={selectedWarId}
              onWarChange={setSelectedWarId}
              canManageWar={canManageWar}
              hasActiveWar={hasActiveWar}
              selectedWar={selectedWar}
              onOpenCreateDialog={() => setShowCreateDialog(true)}
              onOpenEndWarConfirm={() => setShowEndWarConfirm(true)}
            />
          )}

          {/* ── Defenders tab ────────────────────────────── */}
          {activeTab === WarTab.Defenders && (
            <>
              {!activeWarId ? (
                <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
              ) : (
                <WarDefendersTab
                  activeWar={activeWar}
                  selectedBg={selectedBg}
                  onBgChange={setSelectedBg}
                  canManageWar={canManageWar}
                  warMode={warMode}
                  onWarModeChange={setWarMode}
                  warLoading={warLoading}
                  placements={placements}
                  onNodeClick={handleNodeClick}
                  onRemoveDefender={handleRemoveDefender}
                  onRemoveAttacker={handleRemoveAttacker}
                  onUpdateKo={handleUpdateKo}
                  onOpenClearConfirm={() => setShowClearConfirm(true)}
                />
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
