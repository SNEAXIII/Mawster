'use client';

import { ArrowUpCircle, Crown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { cn } from '@/app/lib/utils';
import { Button } from '@/components/ui/button';
import { getChampionImageUrl } from '@/app/services/champions';
import { RARITY_LABELS, getClassColors, raritySortValue, shortenChampionName } from '@/app/services/roster';
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
        <span className='font-semibold'>{shortenChampionName(championName)}</span>
        <span className='text-xs text-muted-foreground' data-cy='champion-owner-count'>
          {t.game.alliances.championSearch.ownerCount.replace('{count}', String(entries.length))}
        </span>
      </div>
      <ul className='flex flex-col divide-y'>
        {sorted.map((e) => (
          <li key={e.id} className='flex items-center gap-2 py-1 text-sm' data-cy='champion-owner-row'>
            {e.is_preferred_attacker && (
              <Crown
                className='h-3 w-3 shrink-0 text-yellow-400'
                data-cy='champion-owner-preferred'
              />
            )}
            <span
              className={cn(
                'flex-1 truncate',
                e.is_preferred_attacker && 'text-yellow-400 font-medium'
              )}
            >
              {e.game_pseudo}
            </span>
            <span className='text-xs font-bold text-muted-foreground'>
              {RARITY_LABELS[e.rarity] ?? e.rarity}
            </span>
            {e.signature > 0 ? (
              <span className='text-amber-400 text-xs font-semibold' data-cy='champion-owner-sig'>
                sig {e.signature}
              </span>
            ) : (
              <span className='text-white/50 text-xs' data-cy='champion-owner-sig'>
                sig 0
              </span>
            )}
            {e.ascension > 0 && (
              <span
                className='text-purple-400 text-xs font-semibold'
                data-cy='champion-owner-ascension'
              >
                A{e.ascension}
              </span>
            )}
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
