'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupGridResponse } from '@/app/services/matchups';
import MatchupGridAxisList from './matchup-grid-axis-list';
import MatchupGridMatrix from './matchup-grid-matrix';
import MatchupGridNodeFilters from './matchup-grid-node-filters';
import { visibleNodes } from './node-filters';

interface Props {
  grid: MatchupGridResponse | null;
  loading: boolean;
}

// Attacker-centric grid: defenders x nodes score matrix for one attacker, shown when the
// user picked an attacker but no specific defender/node target (see `showGrid` in the
// viewmodel). Whole-table greying only (is_owned === false) — per-cell synergy greying is
// out of scope for this task.
export default function MatchupGridTable({ grid, loading }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const [nodeFilter, setNodeFilter] = useState('all');

  if (!loading && !grid) {
    return (
      <p className='text-muted-foreground text-sm' data-cy='matchup-empty'>
        {kb.gridEmpty}
      </p>
    );
  }
  if (!grid) return null;

  const { attacker, is_owned, instance_label, is_on_defense, defenders, nodes, cells } = grid;
  const isEmpty = defenders.length === 0 && nodes.length === 0;
  const hasBothAxes = defenders.length > 0 && nodes.length > 0;
  const columns = visibleNodes(nodeFilter);

  return (
    <div className='flex flex-col gap-2' data-cy='matchup-grid-container'>
      <div className='flex items-center gap-2'>
        {attacker.image_url && (
          <img
            src={getChampionImageUrl(attacker.image_url, 32) ?? ''}
            alt={attacker.champion_name}
            className='w-8 h-8 object-contain'
          />
        )}
        <span className='font-medium'>{attacker.champion_name}</span>
        {instance_label && (
          <span className='text-muted-foreground' data-cy='matchup-grid-instance'>
            {instance_label}
          </span>
        )}
        {is_on_defense && (
          <span
            className='flex items-center gap-1 text-amber-500'
            data-cy='matchup-grid-on-defense'
          >
            <ShieldAlert className='h-3.5 w-3.5' />
            {kb.onDefenseWarning}
          </span>
        )}
      </div>
      {is_owned === false && (
        <p className='text-muted-foreground text-sm' data-cy='matchup-grid-not-owned'>
          {kb.gridNotOwned}
        </p>
      )}
      {!isEmpty && hasBothAxes && (
        <MatchupGridNodeFilters value={nodeFilter} onChange={setNodeFilter} />
      )}
      <div className={cn('overflow-x-auto', is_owned === false && 'opacity-50')}>
        {isEmpty && (
          <p className='text-muted-foreground text-sm' data-cy='matchup-empty'>
            {kb.gridEmpty}
          </p>
        )}
        {!isEmpty && hasBothAxes && (
          <MatchupGridMatrix defenders={defenders} cells={cells} columns={columns} />
        )}
        {!isEmpty && !hasBothAxes && (
          <MatchupGridAxisList
            entries={defenders.length > 0 ? defenders : nodes}
            axis={defenders.length > 0 ? 'defender' : 'node'}
          />
        )}
      </div>
    </div>
  );
}
