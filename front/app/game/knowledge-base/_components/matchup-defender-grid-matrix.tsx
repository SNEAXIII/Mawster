'use client';

import { X } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupDefenderGridCell, MatchupDefenderGridRow } from '@/app/services/matchups';
import { SCORE_BADGE_CLASS, scoreClass } from './grid-score';

interface Props {
  attackers: MatchupDefenderGridRow[];
  cells: MatchupDefenderGridCell[];
  columns: number[];
}

// Mirror of MatchupGridMatrix, centered on a defender: attackers as rows, the visible nodes
// (filtered by section/path upstream) as columns, `cells` looked up by (attacker, node).
// Cells with no rating stay blank.
export default function MatchupDefenderGridMatrix({ attackers, cells, columns }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const cellFor = (attackerId: string, node: number): MatchupDefenderGridCell | null =>
    cells.find((c) => c.attacker_champion_id === attackerId && c.node_number === node) ?? null;

  return (
    <table className='w-full text-sm' data-cy='matchup-defender-grid'>
      <thead className='text-muted-foreground'>
        <tr>
          <th className='text-left py-2'>{kb.attacker}</th>
          {columns.map((node) => (
            <th key={node} className='text-left px-2 font-normal'>
              #{node}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {attackers.map((row) => (
          <tr key={row.attacker.champion_id} className='border-t'>
            <td className='py-2'>
              <span className='flex items-center gap-2'>
                {row.attacker.image_url && (
                  <img
                    src={getChampionImageUrl(row.attacker.image_url, 32) ?? ''}
                    alt={row.attacker.champion_name}
                    className='w-8 h-8 object-contain'
                  />
                )}
                <span>{row.attacker.champion_name}</span>
              </span>
            </td>
            {columns.map((node) => {
              const cell = cellFor(row.attacker.champion_id, node);
              return (
                <td
                  key={node}
                  className='px-2'
                  data-cy='matchup-defender-grid-cell'
                  data-cy-attacker={row.attacker.champion_id}
                  data-cy-node={String(node)}
                >
                  {!cell ? (
                    ''
                  ) : cell.is_discouraged ? (
                    <X className='h-4 w-4 text-destructive' aria-label={kb.verdictDiscouraged} />
                  ) : (
                    <span className={`${SCORE_BADGE_CLASS} ${scoreClass(cell.score)}`}>
                      {cell.score}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
