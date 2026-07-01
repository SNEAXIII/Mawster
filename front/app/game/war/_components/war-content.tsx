'use client';

import dynamic from 'next/dynamic';
import { useRequiredSession } from '@/hooks/use-required-session';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useI18n } from '@/app/i18n';
import { useState } from 'react';
import { WarProvider, useWar } from '@/app/contexts/war-context';
import WarHeader from './war-header';
import WarTab from './war-tab';
import WarManagementBar from './war-management-bar';
import WarFormDialog from './war-form-dialog';
import AttackerEntryRow from './attacker-entry-row';
import EndWarDialog from './end-war-dialog';

const WarDefenderSelector = dynamic(() => import('./war-defender-selector'), {
  loading: () => <FullPageSpinner />,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => <FullPageSpinner />,
});

export default function WarContent({
  onStateChange,
  initialAllianceId,
  initialBg,
}: Readonly<{
  onStateChange?: (allianceId: string, bg: number) => void;
  initialAllianceId?: string;
  initialBg?: number;
}>) {
  return (
    <WarProvider
      onStateChange={onStateChange}
      initialAllianceId={initialAllianceId}
      initialBg={initialBg}
    >
      <WarLayout />
    </WarProvider>
  );
}

function WarLayout() {
  const { t } = useI18n();
  useRequiredSession();

  const [showEditDialog, setShowEditDialog] = useState(false);

  const {
    alliances,
    selectedAllianceId,
    handleAllianceChange,
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
    handleEditWar,
    handleEndWar,
    handlePlaceDefender,
    handleAssignAttacker,
    handleConfirmRemoveDefender,
    handleClearBg,
  } = useWar();

  if (loading) return <FullPageSpinner />;

  const pendingPlacement =
    pendingRemoveNode !== null
      ? placements.find((p) => p.node_number === pendingRemoveNode)
      : undefined;

  return (
    <div className='w-full px-3 py-4 sm:p-6 flex flex-col gap-4 sm:gap-6'>
      {alliances.length === 0 ? (
        <p className='text-muted-foreground'>{t.game.war.noAlliance}</p>
      ) : (
        <>
          <WarHeader
            alliances={alliances}
            selectedAllianceId={selectedAllianceId}
            onAllianceChange={handleAllianceChange}
          />

          {/* ── Management bar (officers/owners only, no active war) ──── */}
          {canManageWar && !currentWar && (
            <WarManagementBar
              currentWar={currentWar}
              loading={managementLoading}
              onClickDeclare={() => setShowCreateDialog(true)}
            />
          )}

          {/* ── War map ──────────────────────────────────── */}
          {activeWarId ? (
            <WarTab onEditClick={() => setShowEditDialog(true)} />
          ) : (
            <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
          )}
        </>
      )}

      {/* Declare war dialog */}
      <WarFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateWar}
      />

      {/* Edit war dialog */}
      <WarFormDialog
        mode='edit'
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onConfirm={handleEditWar}
        initialOpponentName={currentWar?.opponent_name ?? ''}
        initialBannedIds={currentWar?.banned_champions.map((c) => c.id) ?? []}
      />

      {/* End war dialog */}
      <EndWarDialog
        open={showEndConfirm}
        onOpenChange={setShowEndConfirm}
        hasSeason={!!currentWar?.season_id}
        onConfirm={async (win, eloChange) => {
          await handleEndWar(win, eloChange);
        }}
      />

      {/* Defender champion selector */}
      <WarDefenderSelector
        open={selectorNode !== null}
        onClose={() => setSelectorNode(null)}
        nodeNumber={selectorNode ?? 0}
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
        {pendingPlacement && (
          <div className='flex justify-center'>
            <AttackerEntryRow
              placement={pendingPlacement}
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
