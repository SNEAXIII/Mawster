'use client';

import { useRef, useState } from 'react';
import { snapdom } from '@zumer/snapdom';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Shield } from 'lucide-react';
import { DefenseActionsProvider } from '@/app/contexts/defense-actions-context';
import DefenseHeader from './defense-header';
import DefenseGrid from './defense-grid';
import { useDefenseViewModel } from '../_viewmodels/use-defense-viewmodel';

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

  const vm = useDefenseViewModel({ onStateChange, initialAllianceId, initialBg });

  const exportDefenseMapRef = useRef<HTMLDivElement>(null);
  const exportDefenseAssignementsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const selectedAlliance = vm.alliances.find((a) => a.id === vm.selectedAllianceId) ?? null;

  const handleExport = async () => {
    if (!exportDefenseMapRef.current || !exportDefenseAssignementsRef.current) return;
    setExporting(true);
    // Wait for React to commit the state change (bg-black, hidden remove buttons) to the DOM
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const pngMap = await snapdom.toPng(exportDefenseMapRef.current, { scale: 2, embedFonts: false });
      const pngAssignements = await snapdom.toPng(exportDefenseAssignementsRef.current, { scale: 2, embedFonts: false });
      const allianceName = selectedAlliance?.name ?? 'alliance';
      const date = new Date().toISOString().split('T')[0];
      const linkMap = document.createElement('a');
      linkMap.download = `defense-bg${vm.selectedBg}-${allianceName}-${date}.png`;
      linkMap.href = pngMap.src;
      linkMap.click();
      const linkAssignements = document.createElement('a');
      linkAssignements.download = `defense-assignments-bg${vm.selectedBg}-${allianceName}-${date}.png`;
      linkAssignements.href = pngAssignements.src;
      linkAssignements.click();
    } finally {
      setExporting(false);
    }
  };

  if (vm.loading || status === 'loading') return <FullPageSpinner />;

  if (vm.alliances.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center'>
        <Shield className='size-16 text-muted-foreground mb-4' />
        <p className='text-muted-foreground'>{t.game.defense.noAlliance}</p>
      </div>
    );
  }

  const { defenseActions } = vm;

  return (
    <div className='flex flex-col gap-4'>
      <DefenseActionsProvider value={defenseActions}>
        <DefenseHeader
          alliances={vm.alliances}
          selectedAllianceId={vm.selectedAllianceId}
          onAllianceChange={vm.handleAllianceChange}
          selectedBg={vm.selectedBg}
          onBgChange={vm.handleBgChange}
          onClearClick={() => defenseActions.setClearConfirmOpen(true)}
          canManage={vm.userCanManage}
          defenseSummary={defenseActions.defenseSummary}
          onExportClick={handleExport}
          exporting={exporting}
        />
        <DefenseGrid
          onNodeClick={vm.handleNodeClick}
          canManage={vm.userCanManage}
          exportDefenseMapRef={exportDefenseMapRef}
          exportDefenseAssignementsRef={exportDefenseAssignementsRef}
          exporting={exporting}
          selectedAllianceTag={selectedAlliance?.tag}
          selectedAllianceName={selectedAlliance?.name}
          selectedBg={vm.selectedBg}
        />
      </DefenseActionsProvider>
    </div>
  );
}
