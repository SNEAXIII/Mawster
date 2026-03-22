'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { type War, type WarPlacement, getCurrentWar, createWar, endWar } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { toast } from 'sonner';
import { WarMode } from './war-types';
import WarHeader from './war-header';
import WarDefendersTab from './war-defenders-tab';
import WarManagementBar from './war-management-bar';
import CreateWarDialog from './create-war-dialog';

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => null,
});

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

  const [currentWar, setCurrentWar] = useState<War | null>(null);
  const [managementLoading, setManagementLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Defenders);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

  // ─── Fetch current war when alliance changes ──────────────
  const fetchCurrentWar = useCallback(async () => {
    if (!selectedAllianceId) return;
    setManagementLoading(true);
    try {
      const war = await getCurrentWar(selectedAllianceId);
      setCurrentWar(war);
    } catch (err: any) {
      if (err.status === 404) {
        setCurrentWar(null);
      } else {
        toast.error(t.game.war.loadError);
      }
    } finally {
      setManagementLoading(false);
    }
  }, [selectedAllianceId, t.game.war.loadError]);

  useEffect(() => {
    setCurrentWar(null);
    fetchCurrentWar();
  }, [selectedAllianceId, fetchCurrentWar]);

  const activeWarId = currentWar?.id ?? '';

  const {
    warSummary,
    warLoading,
    selectorNode,
    setSelectorNode,
    attackerSelectorNode,
    setAttackerSelectorNode,
    showClearConfirm,
    setShowClearConfirm,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearBg,
    handleAssignAttacker,
    handleRemoveAttacker,
    handleUpdateKo,
  } = useWarActions(selectedAllianceId, selectedBg, activeWarId);

  // ─── Actions ─────────────────────────────────────────────

  const placements: WarPlacement[] = warSummary?.placements ?? [];

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;

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
      if (!selectedAlliance || !canManage(selectedAlliance)) return;
      setSelectorNode(nodeNumber);
    }
  };

  const handleCreateWar = async (opponentName: string) => {
    try {
      const war = await createWar(selectedAllianceId, opponentName);
      toast.success(t.game.war.createSuccess.replace('{name}', opponentName));
      setCurrentWar(war);
    } catch (err: any) {
      toast.error(err.message || t.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async () => {
    if (!currentWar) return;
    try {
      await endWar(selectedAllianceId, currentWar.id);
      toast.success(t.game.war.endWarSuccess);
      setCurrentWar(null);
    } catch (err: any) {
      toast.error(err.message || t.game.war.endWarError);
    }
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) return <FullPageSpinner />;

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

          {/* ── Management bar (officers/owners only) ──── */}
          {canManageWar && (
            <WarManagementBar
              activeWar={currentWar}
              loading={managementLoading}
              onClickDeclare={() => setShowCreateDialog(true)}
              onClickEndWar={() => setShowEndConfirm(true)}
            />
          )}

          {/* ── War map ──────────────────────────────────── */}
          {!activeWarId ? (
            <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
          ) : (
            <WarDefendersTab
              activeWar={currentWar ?? undefined}
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

      {/* Declare war dialog */}
      <CreateWarDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateWar}
      />

      {/* End war confirm */}
      <ConfirmationDialog
        open={showEndConfirm}
        onOpenChange={setShowEndConfirm}
        onConfirm={async () => {
          setShowEndConfirm(false);
          await handleEndWar();
        }}
        title={t.game.war.endWarConfirmTitle}
        description={t.game.war.endWarConfirmDesc}
        variant='destructive'
      />

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
