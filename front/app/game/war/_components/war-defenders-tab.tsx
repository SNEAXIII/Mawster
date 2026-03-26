'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Shield, Swords, Trash2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { WarMode } from './war-types';
import type { War, WarPlacement } from '@/app/services/war';

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
});

const WarAttackerPanel = dynamic(() => import('./war-attacker-panel'), {
  loading: () => null,
});

interface WarDefendersTabProps {
  activeWar: War | undefined;
  selectedBg: number;
  onBgChange: (bg: number) => void;
  canManageWar: boolean;
  warMode: WarMode;
  onWarModeChange: (mode: WarMode) => void;
  warLoading: boolean;
  placements: WarPlacement[];
  onNodeClick: (node: number) => void;
  onRemoveDefender: (node: number) => void;
  onRemoveAttacker: (node: number) => Promise<void>;
  onUpdateKo: (node: number, newKo: number) => Promise<void>;
  onOpenClearConfirm: () => void;
  onClickEndWar: () => void;
}

export default function WarDefendersTab({
  activeWar,
  selectedBg,
  onBgChange,
  canManageWar,
  warMode,
  onWarModeChange,
  warLoading,
  placements,
  onNodeClick,
  onRemoveDefender,
  onRemoveAttacker,
  onUpdateKo,
  onOpenClearConfirm,
  onClickEndWar,
}: Readonly<WarDefendersTabProps>) {
  const { t } = useI18n();

  return (
    <div className='space-y-4'>
      {/* Controls row: opponent name + BG picker + mode toggle + clear */}
      <div className='flex flex-wrap items-center gap-3'>
        {/* Opponent name */}
        {activeWar && (
          <div className='flex items-center gap-2'>
            <Swords className='w-4 h-4 text-muted-foreground' />
            <span
              data-cy='war-opponent-name'
              className='text-sm font-semibold'
            >
              vs {activeWar.opponent_name}
            </span>
          </div>
        )}

        {/* BG button group */}
        <div
          className='flex gap-1 rounded-md border p-1'
          data-cy='bg-picker'
        >
          {[1, 2, 3].map((bg) => (
            <button
              key={bg}
              onClick={() => onBgChange(bg)}
              className={cn(
                'px-3 py-1 rounded text-sm font-semibold transition-colors',
                selectedBg === bg
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
              data-cy={`bg-btn-${bg}`}
            >
              G{bg}
            </button>
          ))}
        </div>

        {/* Mode toggle — visible to officers only */}
        {canManageWar && (
          <div
            className='flex gap-1 rounded-md border p-1'
            data-cy='war-mode-toggle'
          >
            <button
              onClick={() => onWarModeChange(WarMode.Defenders)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
                warMode === WarMode.Defenders
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
              data-cy='war-mode-defenders'
            >
              <Shield className='w-3.5 h-3.5' />
              {t.game.war.modeDefenders}
            </button>
            <button
              onClick={() => onWarModeChange(WarMode.Attackers)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
                warMode === WarMode.Attackers
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
              data-cy='war-mode-attackers'
            >
              <Swords className='w-3.5 h-3.5' />
              {t.game.war.modeAttackers}
            </button>
          </div>
        )}

        {/* Clear BG button */}
        {canManageWar && placements.length > 0 && (
          <Button
            variant='outline'
            onClick={onOpenClearConfirm}
            data-cy='clear-war-bg-btn'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            {t.game.war.clearAll}
          </Button>
        )}

        {/* End war button */}
        {canManageWar && (
          <Button
            variant='destructive'
            onClick={onClickEndWar}
            className='ml-auto'
            data-cy='end-war-btn'
          >
            {t.game.war.endWar}
          </Button>
        )}
      </div>

      {warLoading ? (
        <FullPageSpinner />
      ) : (
        <div className='flex gap-4 flex-col lg:flex-row'>
          <div className='overflow-x-auto flex-1 min-w-0 rounded-xl border bg-card shadow-sm'>
            <div className='p-2 sm:p-3 w-max mx-auto'>
              <WarDefenseMap
                placements={placements}
                onNodeClick={onNodeClick}
                onRemove={onRemoveDefender}
                canManage={canManageWar && warMode === WarMode.Defenders}
              />
            </div>
          </div>
          {warMode === WarMode.Attackers && (
            <div className='w-64 shrink-0'>
              <WarAttackerPanel
                placements={placements}
                onRemoveAttacker={onRemoveAttacker}
                onUpdateKo={onUpdateKo}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
