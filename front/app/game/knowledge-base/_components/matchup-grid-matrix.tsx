'use client';

import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupGridAxisEntry, MatchupGridCell } from '@/app/services/matchups';

interface Props {
  defenders: MatchupGridAxisEntry[];
  nodes: MatchupGridAxisEntry[];
  cells: MatchupGridCell[];
}

// Full two-axis matrix: defenders as rows, nodes as columns, `cells` looked up by pair.
export default function MatchupGridMatrix({ defenders, nodes, cells }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const rows = defenders.filter((d) => d.defender !== null);
  const columns = nodes.filter((n) => n.node_number !== null);

  const cellFor = (defenderId: string, node: number): MatchupGridCell | null =>
    cells.find((c) => c.defender_champion_id === defenderId && c.node_number === node) ?? null;

  return (
    <table className='w-full text-sm' data-cy='matchup-grid'>
      <thead className='text-muted-foreground'>
        <tr>
          <th className='text-left py-2'>{kb.defender}</th>
          {columns.map((n) => (
            <th key={n.node_number} className='text-left px-2'>
              {n.node_number}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.defender!.champion_id} className='border-t'>
            <td className='py-2'>
              <span className='flex items-center gap-2'>
                {row.defender!.image_url && (
                  <img
                    src={getChampionImageUrl(row.defender!.image_url, 32) ?? ''}
                    alt={row.defender!.champion_name}
                    className='w-8 h-8 object-contain'
                  />
                )}
                <span>{row.defender!.champion_name}</span>
              </span>
            </td>
            {columns.map((n) => {
              const cell = cellFor(row.defender!.champion_id, n.node_number!);
              return (
                <td
                  key={n.node_number}
                  className='px-2'
                  data-cy='matchup-grid-cell'
                  data-cy-defender={row.defender!.champion_id}
                  data-cy-node={String(n.node_number)}
                >
                  {!cell ? (
                    '—'
                  ) : cell.is_discouraged ? (
                    <span className='text-destructive font-medium'>{kb.verdictDiscouraged}</span>
                  ) : (
                    cell.score
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
