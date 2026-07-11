'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useI18n } from '@/app/i18n';
import { ActionIconButton } from '@/components/action-icon-button';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import type { MatchupRating } from '@/app/services/matchups';

interface Props {
  ratings: MatchupRating[];
  attackerId: string | null;
  onDelete: (ratingId: string) => Promise<void>;
}

export default function MatchupTable({ ratings, attackerId, onDelete }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (attackerId === null) {
    return (
      <p className='text-muted-foreground text-sm' data-cy='matchup-table-select-attacker-hint'>
        {kb.selectAttackerHint}
      </p>
    );
  }

  if (ratings.length === 0) {
    return <p className='text-muted-foreground text-sm'>{kb.noMatchups}</p>;
  }

  return (
    <>
      <div className='max-h-[26rem] overflow-y-auto rounded-md border'>
        <table className='w-full text-sm' data-cy='matchup-table'>
          <tbody>
            {ratings.map((rating) => (
              <tr key={rating.id} className='border-t' data-cy='matchup-table-row'>
                <td className='py-2 pl-2'>{rating.champion.champion_name}</td>
                <td>
                  {rating.target_type === 'defender'
                    ? rating.defender?.champion_name
                    : `${kb.node} ${rating.node_number}`}
                </td>
                <td>{rating.verdict}</td>
                <td className='text-right'>
                  <ActionIconButton
                    icon={<FiTrash2 />}
                    title={kb.deleteMatchup}
                    variant='danger'
                    onClick={() => setPendingId(rating.id)}
                    data-cy='matchup-delete'
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmationDialog
        open={pendingId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingId(null);
        }}
        title={t.common.confirm}
        description={kb.deleteMatchupConfirm}
        confirmText={kb.deleteMatchup}
        variant='destructive'
        onConfirm={async () => {
          if (pendingId) await onDelete(pendingId);
          setPendingId(null);
        }}
      />
    </>
  );
}
