'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupGridAxisEntry, MatchupGridCell } from '@/app/services/matchups';
import { SCORE_BADGE_CLASS, scoreClass } from './grid-score';
import MatchupCellDetail from './matchup-cell-detail';

interface Props {
  defenders: MatchupGridAxisEntry[];
  nodes: MatchupGridAxisEntry[];
  cells: MatchupGridCell[];
  columns: number[];
}

interface Selected {
  defender: MatchupGridAxisEntry;
  node: MatchupGridAxisEntry;
  cell: MatchupGridCell;
}

// Full two-axis matrix: defenders as rows, nodes as columns, `cells` looked up by pair.
// `columns` is the visible node set (filtered by section/path upstream); cells with no
// rating stay blank. Clicking a rated cell opens its fight detail.
export default function MatchupGridMatrix({ defenders, nodes, cells, columns }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const [selected, setSelected] = useState<Selected | null>(null);

  const rows = defenders.filter((d) => d.defender !== null);

  const cellFor = (defenderId: string, node: number): MatchupGridCell | null =>
    cells.find((c) => c.defender_champion_id === defenderId && c.node_number === node) ?? null;

  const openDetail = (row: MatchupGridAxisEntry, node: number, cell: MatchupGridCell) => {
    const nodeEntry = nodes.find((n) => n.node_number === node);
    if (nodeEntry) setSelected({ defender: row, node: nodeEntry, cell });
  };

  return (
    <>
      <table className='w-full text-sm' data-cy='matchup-grid'>
      <thead className='text-muted-foreground'>
        <tr>
          <th rowSpan={2} className='text-left py-2 align-bottom'>
            {kb.defender}
          </th>
        </tr>
        <tr>
          {columns.map((node) => (
            <th key={node} className='text-left px-2 font-normal'>
              #{node}
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
            {columns.map((node) => {
              const cell = cellFor(row.defender!.champion_id, node);
              return (
                <td
                  key={node}
                  className={cn('px-2', cell && 'cursor-pointer hover:bg-muted/50')}
                  data-cy='matchup-grid-cell'
                  data-cy-defender={row.defender!.champion_id}
                  data-cy-node={String(node)}
                  onClick={() => cell && openDetail(row, node, cell)}
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
      <MatchupCellDetail
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        defender={selected?.defender ?? null}
        node={selected?.node ?? null}
        cell={selected?.cell ?? null}
      />
    </>
  );
}
