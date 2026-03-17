'use client';

import { useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Shield } from 'lucide-react';

import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useDefenseActions } from '../_hooks/use-defense-actions';

import DefenseHeader from './defense-header';
import DefenseGrid from './defense-grid';

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
  } = useDefenseActions(selectedAllianceId, selectedBg, selectedAlliance?.tag);

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

  const handleBgChange = (bg: number) => {
    setSelectedBg(bg);
    if (selectedAllianceId) onStateChange?.(selectedAllianceId, bg);
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
      <DefenseHeader
        alliances={alliances}
        selectedAllianceId={selectedAllianceId}
        onAllianceChange={handleAllianceChange}
        selectedBg={selectedBg}
        onBgChange={handleBgChange}
        onExport={handleExportDefense}
        onImportClick={() => fileInputRef.current?.click()}
        onClearClick={() => setClearConfirmOpen(true)}
        canManage={userCanManage}
        defenseSummary={defenseSummary}
      />

      <DefenseGrid
        allianceId={selectedAllianceId}
        bg={selectedBg}
        defenseSummary={defenseSummary}
        availableChampions={availableChampions}
        bgMembers={bgMembers}
        selectorNode={selectorNode}
        onNodeClick={handleNodeClick}
        onPlace={handlePlaceDefender}
        onRemove={handleRemoveDefender}
        clearConfirmOpen={clearConfirmOpen}
        onClearConfirm={handleClearDefense}
        setClearConfirmOpen={setClearConfirmOpen}
        onSelectorClose={() => setSelectorNode(null)}
        fileInputRef={fileInputRef}
        onImportFile={handleImportFile}
        importReportOpen={importReportOpen}
        importReport={importReport}
        onImportReportClose={() => setImportReportOpen(false)}
        loading={defenseLoading}
        canManage={userCanManage}
      />
    </div>
  );
}
