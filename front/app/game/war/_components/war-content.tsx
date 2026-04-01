'use client';

import dynamic from 'next/dynamic';
import { useRequiredSession } from '@/hooks/use-required-session';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useI18n } from '@/app/i18n';
import { WarProvider, useWar } from '../_context/war-context';
import WarHeader from './war-header';
import WarDefendersTab from './war-defenders-tab';
import WarManagementBar from './war-management-bar';
import CreateWarDialog from './create-war-dialog';
import AttackerEntryRow from './attacker-entry-row';

const WarDefenderSelector = dynamic(() => import('./war-defender-selector'), {
  loading: () => <FullPageSpinner />,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => <FullPageSpinner />,
});

export default function WarContent() {
  return (
    <WarProvider>
      <WarLayout />
    </WarProvider>
  );
}

function WarLayout() {
  const { t } = useI18n();
  useRequiredSession();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    loading,
    canManageWar,
    currentWar,
    activeWarId,
    managementLoading,
    placements,
    selectorNode,
    setSelectorNode,
    attackerSelectorNode,
    setAttackerSelectorNode,
    showClearConfirm,
    setShowClearConfirm,
    showCreateDialog,
    setShowCreateDialog,
    showEndConfirm,
    setShowEndConfirm,
    pendingRemoveNode,
    setPendingRemoveNode,
    handleCreateWar,
    handleEndWar,
    handlePlaceDefender,
    handleAssignAttacker,
    handleConfirmRemoveDefender,
    handleClearBg,
  } = useWar();

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

          {/* ── Management bar (officers/owners only, no active war) ──── */}
          {canManageWar && !currentWar && (
            <WarManagementBar
              loading={managementLoading}
              onClickDeclare={() => setShowCreateDialog(true)}
            />
          )}

          {/* ── War map ──────────────────────────────────── */}
          {activeWarId ? (
            <WarDefendersTab />
          ) : (
            <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
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
        requireConfirmText='confirm'
      />

      {/* Defender champion selector */}
      <WarDefenderSelector
        open={selectorNode !== null}
        onClose={() => setSelectorNode(null)}
        nodeNumber={selectorNode ?? 0}
        placedChampionIds={new Set(placements.map((p) => p.champion_id))}
        currentPlacement={placements.find((p) => p.node_number === selectorNode)}
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

      {/* Remove defender with attacker confirm dialog */}
      <ConfirmationDialog
        open={pendingRemoveNode !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveNode(null);
        }}
        onConfirm={handleConfirmRemoveDefender}
        title={t.game.war.removeDefenderWithAttackerTitle}
        description={t.game.war.removeDefenderWithAttackerDesc}
        variant='destructive'
      >
        {pendingRemoveNode !== null &&
          placements.find((p) => p.node_number === pendingRemoveNode) && (
            <div className='flex justify-center'>
              <AttackerEntryRow
                placement={placements.find((p) => p.node_number === pendingRemoveNode)!}
                mode='full'
                readonly
              />
            </div>
          )}
      </ConfirmationDialog>

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
