'use client';

import dynamic from 'next/dynamic';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Swords, Trash2, NotebookPen, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import ChampionPortrait from '@/components/champion-portrait';
import { WarMode } from './war-types';
import { useWar } from '@/app/contexts/war-context';
import SeasonBanner from './season-banner';


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

export default function WarTab() {
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
    alliances,
    selectedAllianceId,
    handleUpdateAllianceElo,
    handleUpdateAllianceTier,
  } = useWar();

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId) ?? null;

  const [editingElo, setEditingElo] = useState(false);
  const [editingTier, setEditingTier] = useState(false);
  const [eloDraft, setEloDraft] = useState('');
  const [tierDraft, setTierDraft] = useState('');

  function startEditElo() {
    setEloDraft(String(selectedAlliance?.elo ?? 0));
    setEditingElo(true);
  }

  async function saveElo() {
    const val = Number(eloDraft);
    if (!isNaN(val) && val >= 0 && val <= 4500) {
      await handleUpdateAllianceElo(val);
    }
    setEditingElo(false);
  }

  function startEditTier() {
    setTierDraft(String(selectedAlliance?.tier ?? 20));
    setEditingTier(true);
  }

  async function saveTier() {
    const val = Number(tierDraft);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      await handleUpdateAllianceTier(val);
    }
    setEditingTier(false);
  }
  return (
    <div className='space-y-4'>
      {/* Controls row: opponent name + BG picker + mode toggle + clear */}
      <div className='flex flex-wrap items-center gap-3'>
                    <SeasonBanner
        season={
          currentWar
            ? currentWar.season_number !== null
              ? { number: currentWar.season_number }
              : null
            : undefined
        }
      />

        {/* ELO badge */}
        {selectedAlliance && (
          <div className='flex items-center gap-1.5' data-cy='war-elo-badge'>
            {editingElo ? (
              <div className='flex items-center gap-1'>
                <Input
                  type='number'
                  className='h-7 w-24 text-xs'
                  value={eloDraft}
                  onChange={(e) => setEloDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveElo();
                    if (e.key === 'Escape') setEditingElo(false);
                  }}
                  autoFocus
                  data-cy='war-elo-input'
                />
                <button onClick={() => void saveElo()} className='text-green-600 hover:text-green-700' data-cy='war-elo-save'>
                  <Check className='w-3.5 h-3.5' />
                </button>
                <button onClick={() => setEditingElo(false)} className='text-muted-foreground hover:text-foreground'>
                  <X className='w-3.5 h-3.5' />
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-1'>
                <span className='text-xs font-medium text-muted-foreground'>{t.game.war.elo}:</span>
                <span className='text-xs font-bold' data-cy='war-elo-value'>{selectedAlliance.elo}</span>
                {canManageWar && (
                  <button
                    onClick={startEditElo}
                    className='text-muted-foreground hover:text-foreground'
                    data-cy='war-elo-edit'
                  >
                    <Pencil className='w-3 h-3' />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tier badge */}
        {selectedAlliance && (
          <div className='flex items-center gap-1.5' data-cy='war-tier-badge'>
            {editingTier ? (
              <div className='flex items-center gap-1'>
                <Input
                  type='number'
                  className='h-7 w-20 text-xs'
                  value={tierDraft}
                  onChange={(e) => setTierDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveTier();
                    if (e.key === 'Escape') setEditingTier(false);
                  }}
                  autoFocus
                  data-cy='war-tier-input'
                />
                <button onClick={() => void saveTier()} className='text-green-600 hover:text-green-700' data-cy='war-tier-save'>
                  <Check className='w-3.5 h-3.5' />
                </button>
                <button onClick={() => setEditingTier(false)} className='text-muted-foreground hover:text-foreground'>
                  <X className='w-3.5 h-3.5' />
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-1'>
                <span className='text-xs font-medium text-muted-foreground'>{t.game.war.tier}:</span>
                <span className='text-xs font-bold' data-cy='war-tier-value'>{selectedAlliance.tier}</span>
                {canManageWar && (
                  <button
                    onClick={startEditTier}
                    className='text-muted-foreground hover:text-foreground'
                    data-cy='war-tier-edit'
                  >
                    <Pencil className='w-3 h-3' />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

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
                className='flex flex-col items-center gap-0.5'
              >
                <ChampionPortrait
                  imageUrl={c.image_url}
                  name={c.name}
                  rarity={'7r6'}
                  size={45}
                  is_saga_attacker={c.is_saga_attacker}
                  is_saga_defender={c.is_saga_defender}
                  sagaMode='attacker'
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
          <div className='w-84 shrink-0 self-start sticky top-0 flex flex-col max-h-[calc(100vh-2rem)]'>
            <WarAttackerPanel />
          </div>
        </div>
      )}
    </div>
  );
}
