'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useDefenseActionsContext } from '@/app/contexts/defense-actions-context';

import DefenseImportReportDialog from './defense-import-report-dialog';

const WarMap = dynamic(() => import('./war-map'), {
  loading: () => <FullPageSpinner />,
});

const AllianceDefenseSelector = dynamic(() => import('./alliance-defense-selector'), {
  loading: () => null,
});

const DefenseSidePanel = dynamic(() => import('./defense-side-panel'), {
  loading: () => <FullPageSpinner />,
});

interface DefenseGridProps {
  onNodeClick: (node: number) => void;
  canManage: boolean;
}

export default function DefenseGrid({ onNodeClick, canManage }: Readonly<DefenseGridProps>) {
  const { t } = useI18n();
  const [playerFilter, setPlayerFilter] = useState('');
  const {
    defenseSummary,
    availableChampions,
    bgMembers,
    defenseLoading,
    selectorNode,
    setSelectorNode,
    clearConfirmOpen,
    setClearConfirmOpen,
    importReportOpen,
    importReport,
    setImportReportOpen,
    fileInputRef,
    handleImportFile,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearDefense,
  } = useDefenseActionsContext();

  const dimmedNodes = playerFilter
    ? new Set(
        (defenseSummary?.placements ?? [])
          .filter((p) => p.game_pseudo !== playerFilter)
          .map((p) => p.node_number)
      )
    : undefined;

  if (defenseLoading) return <FullPageSpinner />;

  return (
    <>
      <div className='flex flex-col-reverse lg:flex-row gap-4'>
        {/* War Map */}
        <div className='overflow-x-auto flex-1 min-w-0 rounded-xl border bg-card shadow-sm'>
          <div className='p-2 sm:p-3 w-max mx-auto'>
            <WarMap
              placements={defenseSummary?.placements ?? []}
              onNodeClick={onNodeClick}
              onRemove={handleRemoveDefender}
              canManage={canManage}
              dimmedNodes={dimmedNodes}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className='w-full lg:w-72 xl:w-80 shrink-0'>
          <Card>
            <CardContent className='p-3'>
              <DefenseSidePanel
                members={bgMembers}
                placements={defenseSummary?.placements ?? []}
                onRemoveDefender={handleRemoveDefender}
                canManage={canManage}
                playerFilter={playerFilter}
                onPlayerChange={setPlayerFilter}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Champion selector dialog */}
      {selectorNode !== null && (
        <AllianceDefenseSelector
          open={selectorNode !== null}
          onClose={() => setSelectorNode(null)}
          nodeNumber={selectorNode}
          availableChampions={availableChampions}
          onSelect={handlePlaceDefender}
          currentPlacement={defenseSummary?.placements.find((p) => p.node_number === selectorNode)}
        />
      )}

      {/* Clear confirmation */}
      <ConfirmationDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t.game.defense.clearConfirmTitle}
        description={t.game.defense.clearConfirmDesc}
        confirmText={t.common.confirm}
        onConfirm={handleClearDefense}
        variant='destructive'
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        className='hidden'
        onChange={handleImportFile}
      />

      {/* Import report dialog */}
      <DefenseImportReportDialog
        open={importReportOpen}
        onClose={() => setImportReportOpen(false)}
        report={importReport}
      />
    </>
  );
}
