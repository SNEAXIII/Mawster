'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Shield, Trash2, Download, Upload } from 'lucide-react';

import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useDefenseActions } from '../_hooks/use-defense-actions';

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

interface DefensePageContentProps {
  onStateChange?: (allianceId: string, bg: number) => void;
  initialAllianceId?: string;
  initialBg?: number;
}

export default function DefensePageContent({
  onStateChange,
  initialAllianceId,
  initialBg,
}: Readonly<DefensePageContentProps> = {}) {
  const { t } = useI18n();
  const { status } = useRequiredSession();
  const { canManage, isOwner } = useAllianceRole();

  // Alliance selector
  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector({ initialAllianceId, initialBg });

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const userCanManage = selectedAlliance
    ? canManage(selectedAlliance) || isOwner(selectedAlliance)
    : false;

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
    setImportReportOpen,
    importReport,
    fileInputRef,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearDefense,
    handleExportDefense,
    handleImportFile,
  } = useDefenseActions(selectedAllianceId, selectedBg, onStateChange, selectedAlliance?.tag);

  // Auto-select first alliance when alliances load and none is selected
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      const firstId = alliances[0].id;
      setSelectedAllianceId(firstId);
      onStateChange?.(firstId, selectedBg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliances]);

  // ─── Actions ───────────────────────────────────────────
  const handleNodeClick = (nodeNumber: number) => {
    if (!userCanManage) return;
    setSelectorNode(nodeNumber);
  };

  const handleBgChange = (bg: string) => {
    const newBg = Number.parseInt(bg);
    setSelectedBg(newBg);
    if (selectedAllianceId) onStateChange?.(selectedAllianceId, newBg);
  };

  const handleAllianceChange = (allianceId: string) => {
    setSelectedAllianceId(allianceId);
    setSelectedBg(1);
    onStateChange?.(allianceId, 1);
  };

  // ─── Render ────────────────────────────────────────────
  if (loading || status === 'loading') return <FullPageSpinner />;

  if (alliances.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center'>
        <Shield className='w-16 h-16 text-muted-foreground mb-4' />
        <h2 className='text-xl font-bold mb-2'>{t.game.defense.title}</h2>
        <p className='text-muted-foreground'>{t.game.defense.noAlliance}</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      {/* Controls */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
            {/* Alliance selector — hidden when only one alliance */}
            {alliances.length > 1 && (
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium whitespace-nowrap'>
                  {t.game.defense.alliance}:
                </label>
                <Select
                  value={selectedAllianceId}
                  onValueChange={handleAllianceChange}
                >
                  <SelectTrigger
                    className='w-[200px]'
                    data-cy='defense-alliance-select'
                  >
                    <SelectValue />
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
              </div>
            )}

            {/* BG selector */}
            <div className='flex flex-wrap items-center gap-2'>
              <label className='text-sm font-medium whitespace-nowrap'>
                {t.game.defense.battlegroup}:
              </label>
              <div className='flex gap-1'>
                {[1, 2, 3].map((bg) => (
                  <Button
                    key={bg}
                    variant={selectedBg === bg ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => handleBgChange(String(bg))}
                    data-cy={`defense-bg-${bg}`}
                  >
                    BG {bg}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clear button */}
            {userCanManage && defenseSummary && defenseSummary.placements.length > 0 && (
              <Button
                variant='destructive'
                size='sm'
                className='ml-auto'
                data-cy='defense-clear-all'
                onClick={() => setClearConfirmOpen(true)}
              >
                <Trash2 className='w-4 h-4 mr-1' />
                {t.game.defense.clearAll}
              </Button>
            )}

            {/* Export / Import — managers only */}
            {userCanManage && (
              <div className='flex gap-1 ml-auto'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleExportDefense}
                  data-cy='defense-export'
                >
                  <Download className='w-4 h-4 mr-1' />
                  {t.game.defense.importExport.exportBtn}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => fileInputRef.current?.click()}
                  data-cy='defense-import'
                >
                  <Upload className='w-4 h-4 mr-1' />
                  {t.game.defense.importExport.importBtn}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      {defenseLoading ? (
        <FullPageSpinner />
      ) : (
        <div className='flex flex-col lg:flex-row gap-4'>
          {/* War Map */}
          <div className='flex-1 min-w-0'>
            <Card>
              <CardContent className='p-2 sm:p-3 overflow-x-auto'>
                <WarMap
                  placements={defenseSummary?.placements ?? []}
                  onNodeClick={handleNodeClick}
                  onRemove={handleRemoveDefender}
                  canManage={userCanManage}
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
                  onRemoveDefender={handleRemoveDefender}
                  canManage={userCanManage}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Champion selector dialog */}
      {selectorNode !== null && (
        <ChampionSelector
          open={selectorNode !== null}
          onClose={() => setSelectorNode(null)}
          nodeNumber={selectorNode}
          availableChampions={availableChampions}
          onSelect={handlePlaceDefender}
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
    </div>
  );
}
