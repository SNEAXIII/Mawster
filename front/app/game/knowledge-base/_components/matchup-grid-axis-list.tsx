'use client';

import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupGridAxisEntry, MatchupVerdict } from '@/app/services/matchups';

interface Props {
  entries: MatchupGridAxisEntry[];
  axis: 'defender' | 'node';
}

// Single-axis fallback used when the grid has no nodes (or no defenders) recorded yet:
// one column of verdicts instead of a two-axis score matrix.
export default function MatchupGridAxisList({ entries, axis }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const verdictLabel = (verdict: MatchupVerdict): string => {
    if (verdict === 'discouraged') return kb.verdictDiscouraged;
    if (verdict === 'good') return kb.verdictGood;
    return kb.verdictOk;
  };

  const sortedEntries =
    axis === 'node'
      ? [...entries].sort((a, b) => (a.node_number ?? 0) - (b.node_number ?? 0))
      : entries;

  return (
    <table className='w-full text-sm' data-cy='matchup-grid'>
      <thead className='text-muted-foreground'>
        <tr>
          <th className='text-left py-2'>{axis === 'defender' ? kb.defender : kb.node}</th>
          <th className='text-left'>{kb.score}</th>
        </tr>
      </thead>
      <tbody>
        {sortedEntries.map((entry) => (
          <tr
            key={axis === 'defender' ? entry.defender?.champion_id : entry.node_number}
            className='border-t'
            data-cy='matchup-grid-cell'
            data-cy-defender={axis === 'defender' ? (entry.defender?.champion_id ?? '') : ''}
            data-cy-node={axis === 'node' ? String(entry.node_number) : ''}
          >
            <td className='py-2'>
              {axis === 'defender' ? (
                <span className='flex items-center gap-2'>
                  {entry.defender?.image_url && (
                    <img
                      src={getChampionImageUrl(entry.defender.image_url, 32) ?? ''}
                      alt={entry.defender.champion_name}
                      className='w-8 h-8 object-contain'
                    />
                  )}
                  <span>{entry.defender?.champion_name}</span>
                </span>
              ) : (
                `#${entry.node_number}`
              )}
            </td>
            <td>
              {entry.verdict === 'discouraged' ? (
                <span className='text-destructive font-medium'>{kb.verdictDiscouraged}</span>
              ) : (
                verdictLabel(entry.verdict)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
