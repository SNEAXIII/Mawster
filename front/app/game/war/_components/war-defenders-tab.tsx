'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Swords, Trash2, NotebookPen } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import ChampionPortrait from '@/components/champion-portrait';
import { WarMode } from './war-types';
import { useWar } from '../_context/war-context';

type ToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  dataCy?: string;
  children: ReactNode;
};

function ToggleButton({ active, onClick, dataCy, children }: Readonly<ToggleButtonProps>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
      )}
      data-cy={dataCy}
    >
      {children}
    </button>
  );
}

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
});

const WarAttackerPanel = dynamic(() => import('./war-attacker-panel'), {
  loading: () => <FullPageSpinner />,
});

export default function WarDefendersTab() {
  const { t } = useI18n();
  const {
    currentWar,
    selectedBg,
    setSelectedBg,
    canManageWar,
    warMode,
    setWarMode,
    warLoading,
    placements,
    handleNodeClick,
    handleRemoveDefender,
    setShowClearConfirm,
    setShowEndConfirm,
  } = useWar();

  return (
    <div className='space-y-4'>
      {/* Controls row: opponent name + BG picker + mode toggle + clear */}
      <div className='flex flex-wrap items-center gap-3'>
        {/* Opponent name */}
        {currentWar && (
          <div className='flex items-center gap-2'>
            <Swords className='w-4 h-4 text-muted-foreground' />
            <span
              data-cy='war-opponent-name'
              className='text-sm font-semibold'
            >
              vs {currentWar.opponent_name}
            </span>
          </div>
        )}

        {/* BG button group */}
        <div
          className='flex gap-1 rounded-md border p-1'
          data-cy='bg-picker'
        >
          {[1, 2, 3].map((bg) => (
            <ToggleButton
              key={bg}
              active={selectedBg === bg}
              onClick={() => setSelectedBg(bg)}
              dataCy={`bg-btn-${bg}`}
            >
              G{bg}
            </ToggleButton>
          ))}
        </div>

        {/* Mode toggle — visible to officers only */}
        {canManageWar && (
          <div
            className='flex gap-1 rounded-md border p-1'
            data-cy='war-mode-toggle'
          >
            <ToggleButton
              active={warMode === WarMode.Attackers}
              onClick={() => setWarMode(WarMode.Attackers)}
              dataCy='war-mode-attackers'
            >
              <Swords className='w-3.5 h-3.5' />
              {t.game.war.modeAttackers}
            </ToggleButton>
            <ToggleButton
              active={warMode === WarMode.Defenders}
              onClick={() => setWarMode(WarMode.Defenders)}
              dataCy='war-mode-defenders'
            >
              <Shield className='w-3.5 h-3.5' />
              {t.game.war.modeDefenders}
            </ToggleButton>
            <ToggleButton
              active={warMode === WarMode.Plan}
              onClick={() => setWarMode(WarMode.Plan)}
              dataCy='war-mode-plan'
            >
              <NotebookPen className='w-3.5 h-3.5' />
              {t.game.war.modePlan}
            </ToggleButton>
          </div>
        )}
        {/* Clear BG button */}
        {canManageWar && placements.length > 0 && (
          <Button
            variant='outline'
            onClick={() => setShowClearConfirm(true)}
            data-cy='clear-war-bg-btn'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            {t.game.war.clearAll}
          </Button>
        )}
        {/* Banned champions */}
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-sm shrink-0'>{t.game.war.bans.label}:</span>
          {!currentWar || currentWar.banned_champions.length === 0 ? (
            <span className='text-sm'>{t.game.war.bans.none}</span>
          ) : (
            currentWar.banned_champions.map((c) => (
              <div
                key={c.id}
                title={c.name}
                data-cy={`ban-display-${c.id}`}
              >
                <ChampionPortrait
                  imageUrl={c.image_url}
                  name={c.name}
                  rarity={'7r6'}
                  size={45}
                />
              </div>
            ))
          )}
        </div>
        {/* End war button */}
        {canManageWar && (
          <Button
            variant='destructive'
            onClick={() => setShowEndConfirm(true)}
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
                onNodeClick={handleNodeClick}
                onRemove={handleRemoveDefender}
                canManage={canManageWar && warMode === WarMode.Defenders}
              />
            </div>
          </div>
          <div className='w-64 shrink-0 self-start sticky top-0 flex flex-col max-h-[calc(100vh-2rem)]'>
            <WarAttackerPanel />
          </div>
        </div>
      )}
    </div>
  );
}
