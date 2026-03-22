'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { type WarPlacement } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { useCurrentWar } from '../../defense/_hooks/use-current-war';
import { toast } from 'sonner';
import { WarMode } from './war-types';
import WarHeader from './war-header';
import WarDefendersTab from './war-defenders-tab';

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

  const { currentWar } = useCurrentWar(selectedAllianceId);
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

  const [warMode, setWarMode] = useState<WarMode>(WarMode.Defenders);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

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
  const activeWar = currentWar ?? undefined;

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

          {/* ── Defenders tab ────────────────────────────── */}
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
