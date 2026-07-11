'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupDefenderGridResponse } from '@/app/services/matchups';
import MatchupDefenderGridMatrix from './matchup-defender-grid-matrix';
import MatchupGridNodeFilters from './matchup-grid-node-filters';
import { visibleNodes } from './node-filters';

interface Props {
  grid: MatchupDefenderGridResponse | null;
  loading: boolean;
}

// Defender-centric grid: attackers x nodes score matrix for one defender, shown when the user
// picked a defender alone (see `showDefenderGrid` in the viewmodel). Mirror of MatchupGridTable.
export default function MatchupDefenderGridTable({ grid, loading }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const [nodeFilter, setNodeFilter] = useState('all');

  if (!loading && !grid) {
    return (
      <p className='text-muted-foreground text-sm' data-cy='matchup-defender-empty'>
        {kb.gridEmpty}
      </p>
    );
  }
  if (!grid) return null;

  const { defender, attackers, cells } = grid;
  const columns = visibleNodes(nodeFilter);

  return (
    <div className='flex flex-col gap-2' data-cy='matchup-defender-grid-container'>
      <div className='flex items-center gap-2'>
        {defender.image_url && (
          <img
            src={getChampionImageUrl(defender.image_url, 32) ?? ''}
            alt={defender.champion_name}
            className='w-8 h-8 object-contain'
          />
        )}
        <span className='font-medium'>{defender.champion_name}</span>
      </div>
      {attackers.length > 0 && (
        <MatchupGridNodeFilters value={nodeFilter} onChange={setNodeFilter} />
      )}
      <div className='overflow-x-auto'>
        {attackers.length === 0 ? (
          <p className='text-muted-foreground text-sm' data-cy='matchup-defender-empty'>
            {kb.defenderGridEmpty}
          </p>
        ) : (
          <MatchupDefenderGridMatrix attackers={attackers} cells={cells} columns={columns} />
        )}
      </div>
    </div>
  );
}
