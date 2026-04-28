'use client';

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

  if (vm.loading || status === 'loading') return <FullPageSpinner />;

  if (vm.alliances.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center'>
        <Shield className='w-16 h-16 text-muted-foreground mb-4' />
        <p className='text-muted-foreground'>{t.game.defense.noAlliance}</p>
      </div>
    );
  }

  const { defenseActions } = vm;

  return (
    <div className='space-y-4'>
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
        />
        <DefenseGrid
          onNodeClick={vm.handleNodeClick}
          canManage={vm.userCanManage}
        />
      </DefenseActionsProvider>
    </div>
  );
}
