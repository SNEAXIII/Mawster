'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  type DefenseSummary,
  type AvailableChampion,
  type BgMember,
  type DefenseImportReport,
} from '@/app/services/defense';

import DefenseImportReportDialog from './defense-import-report-dialog';

const WarMap = dynamic(() => import('./war-map'), {
  loading: () => <FullPageSpinner />,
});

const ChampionSelector = dynamic(() => import('./champion-selector'), {
  loading: () => null,
});

const DefenseSidePanel = dynamic(() => import('./defense-side-panel'), {
  loading: () => <FullPageSpinner />,
});

interface DefenseGridProps {
  allianceId: string;
  bg: number;
  defenseSummary: DefenseSummary | null;
  availableChampions: AvailableChampion[];
  bgMembers: BgMember[];
  selectorNode: number | null;
  onNodeClick: (node: number) => void;
  onPlace: (championUserId: string, gameAccountId: string, championName: string) => void;
  onRemove: (node: number) => Promise<void>;
  clearConfirmOpen: boolean;
  onClearConfirm: () => void;
  setClearConfirmOpen: (open: boolean) => void;
  onSelectorClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importReportOpen: boolean;
  importReport: DefenseImportReport | null;
  onImportReportClose: () => void;
  loading: boolean;
  canManage: boolean;
}

export default function DefenseGrid({
  defenseSummary,
  availableChampions,
  bgMembers,
  selectorNode,
  onNodeClick,
  onPlace,
  onRemove,
  clearConfirmOpen,
  onClearConfirm,
  setClearConfirmOpen,
  onSelectorClose,
  fileInputRef,
  onImportFile,
  importReportOpen,
  importReport,
  onImportReportClose,
  loading,
  canManage,
}: Readonly<DefenseGridProps>) {
  const { t } = useI18n();

  if (loading) return <FullPageSpinner />;

  return (
    <>
      <div className='flex flex-col lg:flex-row gap-4'>
        {/* War Map */}
        <div className='flex-1 min-w-0'>
          <Card>
            <CardContent className='p-2 sm:p-3 overflow-x-auto'>
              <WarMap
                placements={defenseSummary?.placements ?? []}
                onNodeClick={onNodeClick}
                onRemove={onRemove}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className='w-full lg:w-72 xl:w-80 shrink-0'>
          <Card>
            <CardContent className='p-3'>
              <DefenseSidePanel
                members={bgMembers}
                placements={defenseSummary?.placements ?? []}
                onRemoveDefender={onRemove}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Champion selector dialog */}
      {selectorNode !== null && (
        <ChampionSelector
          open={selectorNode !== null}
          onClose={onSelectorClose}
          nodeNumber={selectorNode}
          availableChampions={availableChampions}
          onSelect={onPlace}
        />
      )}

      {/* Clear confirmation */}
      <ConfirmationDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t.game.defense.clearConfirmTitle}
        description={t.game.defense.clearConfirmDesc}
        confirmText={t.common.confirm}
        onConfirm={onClearConfirm}
        variant='destructive'
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        className='hidden'
        onChange={onImportFile}
      />

      {/* Import report dialog */}
      <DefenseImportReportDialog
        open={importReportOpen}
        onClose={onImportReportClose}
        report={importReport}
      />
    </>
  );
}
