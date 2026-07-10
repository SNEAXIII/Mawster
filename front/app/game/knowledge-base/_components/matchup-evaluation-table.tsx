'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { MatchupEvaluationRow, MatchupVerdict } from '@/app/services/matchups';

interface Props {
  rows: MatchupEvaluationRow[];
  loading: boolean;
}

export default function MatchupEvaluationTable({ rows, loading }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const verdictLabel = (verdict: MatchupVerdict | null): string => {
    if (verdict === 'discouraged') return kb.verdictDiscouraged;
    if (verdict === 'good') return kb.verdictGood;
    if (verdict === 'ok') return kb.verdictOk;
    return '—';
  };

  if (!loading && rows.length === 0) {
    return (
      <p className='text-muted-foreground text-sm' data-cy='matchup-empty'>
        {kb.noMatchups}
      </p>
    );
  }

  return (
    <table className='w-full text-sm' data-cy='matchup-evaluation-table'>
      <thead className='text-muted-foreground'>
        <tr>
          <th className='text-left py-2'>{kb.attacker}</th>
          <th className='text-left'>{kb.defender}</th>
          <th className='text-left'>{kb.node}</th>
          <th className='text-left'>{kb.score}</th>
          <th className='text-left'>{kb.synergies}</th>
          <th className='text-left'>{kb.prefight}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.champion.champion_id}
            data-cy='matchup-row'
            data-cy-champion={row.champion.champion_name}
            data-cy-playable={String(row.is_playable ?? true)}
            className={cn('border-t', row.is_playable === false && 'opacity-50')}
          >
            <td className='py-2'>
              <span className='flex items-center gap-2'>
                {row.champion.image_url && (
                  <img
                    src={getChampionImageUrl(row.champion.image_url, 32) ?? ''}
                    alt={row.champion.champion_name}
                    className='w-8 h-8 object-contain'
                  />
                )}
                <span>{row.champion.champion_name}</span>
                {row.instance_label && (
                  <span className='text-muted-foreground' data-cy='matchup-instance'>
                    {row.instance_label}
                  </span>
                )}
                {row.is_on_defense && (
                  <span
                    className='flex items-center gap-1 text-amber-500'
                    data-cy='matchup-on-defense'
                  >
                    <ShieldAlert className='h-3.5 w-3.5' />
                    {kb.onDefenseWarning}
                  </span>
                )}
              </span>
              {row.missing_champions.length > 0 && (
                <span className='flex items-center gap-1 text-destructive' data-cy='matchup-missing'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  {kb.notPlayable}:{' '}
                  {row.missing_champions.map((c) => c.champion_name).join(', ')}
                </span>
              )}
            </td>
            <td>{verdictLabel(row.defender_verdict)}</td>
            <td>{verdictLabel(row.node_verdict)}</td>
            <td data-cy='matchup-score'>
              {row.is_discouraged ? (
                <span className='text-destructive font-medium'>{kb.verdictDiscouraged}</span>
              ) : (
                row.score
              )}
            </td>
            <td>
              {row.synergies.map((s) => (
                <span key={s.champion_id} className='mr-2'>
                  {s.champion_name}
                  <span className='text-muted-foreground'>
                    {' '}
                    ({s.is_required ? kb.requiredSynergy : kb.recommendedSynergy})
                  </span>
                </span>
              ))}
            </td>
            <td>{row.prefight?.champion_name ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
