'use client';

import { ArrowUpCircle } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { getChampionImageUrl } from '@/app/services/champions';
import { RARITY_LABELS, getClassColors, raritySortValue } from '@/app/services/roster';
import type { AllianceRosterEntry } from '@/app/services/game';

interface Props {
  championName: string;
  championClass: string;
  imageUrl: string | null;
  entries: AllianceRosterEntry[];
  canRequestUpgrade: boolean;
  onRequestUpgrade: (entry: AllianceRosterEntry) => void;
}

export default function AllianceChampionGroup({
  championName,
  championClass,
  imageUrl,
  entries,
  canRequestUpgrade,
  onRequestUpgrade,
}: Readonly<Props>) {
  const { t } = useI18n();
  const colors = getClassColors(championClass);
  const img = getChampionImageUrl(imageUrl, 40);
  const sorted = [...entries].sort(
    (a, b) => raritySortValue(b.rarity) - raritySortValue(a.rarity) || b.signature - a.signature
  );

  return (
    <div className='rounded-lg border bg-card p-3' data-cy={`champion-group-${championName}`}>
      <div className='flex items-center gap-2 mb-2'>
        {img ? (
          <img src={img} alt={championName} className={`w-8 h-8 rounded object-cover border ${colors.border}`} />
        ) : (
          <span className='w-8 h-8 rounded bg-muted block' />
        )}
        <span className='font-semibold'>{championName}</span>
        <span className='text-xs text-muted-foreground' data-cy='champion-owner-count'>
          {t.game.alliances.championSearch.ownerCount.replace('{count}', String(entries.length))}
        </span>
      </div>
      <ul className='flex flex-col divide-y'>
        {sorted.map((e) => (
          <li key={e.id} className='flex items-center gap-2 py-1 text-sm' data-cy='champion-owner-row'>
            <span className='flex-1 truncate'>{e.game_pseudo}</span>
            <span className='bg-muted text-yellow-400 px-2 py-0.5 rounded text-xs font-bold'>
              {RARITY_LABELS[e.rarity] ?? e.rarity}
            </span>
            <span className='w-10 text-right text-muted-foreground'>{e.signature}</span>
            {canRequestUpgrade && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 px-1'
                data-cy='champion-owner-upgrade'
                onClick={() => onRequestUpgrade(e)}
                title={t.game.alliances.requestUpgrade}
              >
                <ArrowUpCircle className='h-4 w-4' />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
