'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X, Flame } from 'lucide-react';
import { type WarPrefight, type WarPlacement } from '@/app/services/war';
import { useWar } from '../_context/war-context';

interface PrefightEntryRowProps {
  prefight: WarPrefight;
  targetPlacement: WarPlacement | undefined;
  mode?: 'compact' | 'full';
  readonly?: boolean;
}

export default function PrefightEntryRow({
  prefight,
  targetPlacement,
  mode = 'compact',
  readonly = false,
}: Readonly<PrefightEntryRowProps>) {
  const { t } = useI18n();
  const { handleRemovePrefight } = useWar();

  const isFull = mode === 'full';
  const portraitSize = isFull ? 55 : 40;
  const btnSize = isFull ? 'w-7 h-7' : 'w-5 h-5';
  const iconSize = isFull ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  const boxPaddingSize = isFull ? 'px-7 py-2' : 'px-2 py-1.5';

  return (
    <div
      className={cn('flex items-center gap-2 rounded-md bg-card', boxPaddingSize, !isFull && 'border')}
      data-cy={`prefight-entry-node-${prefight.target_node_number}`}
    >
      <div className='flex items-center gap-1 shrink-0'>
        {/* Prefight provider portrait with flame badge */}
        <div className='relative'>
          <ChampionPortrait
            imageUrl={prefight.image_url}
            name={prefight.champion_name}
            rarity={prefight.rarity}
            size={portraitSize}
            mode='prefight'
          />
        </div>
        <Flame className={cn('text-orange-500 shrink-0', iconSize)} />
        {/* Target node defender portrait */}
        {targetPlacement ? (
          <ChampionPortrait
            imageUrl={targetPlacement.image_url}
            name={targetPlacement.champion_name}
            rarity={targetPlacement.rarity}
            size={portraitSize}
          />
        ) : (
          <div
            className='rounded shrink-0 bg-muted border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground/60'
            style={{ width: portraitSize - 8, height: portraitSize - 8 }}
          >
            <Flame className={iconSize} />
          </div>
        )}
      </div>

      <div className='flex-1 min-w-0'>
        <div className='text-[10px] text-muted-foreground'>
          {t.game.war.prefight.for.replace('#{node}', String(prefight.target_node_number))}
        </div>
        <div className='text-[10px] font-medium truncate'>{prefight.champion_name}</div>
      </div>

      {!readonly && (
        <button
          type='button'
          className={cn(
            'rounded-full bg-orange-500/80 hover:bg-orange-500 text-white flex items-center justify-center flex-shrink-0',
            btnSize
          )}
          onClick={() => handleRemovePrefight(prefight.champion_user_id)}
          title={t.game.war.prefight.revoke}
          data-cy={`remove-prefight-node-${prefight.target_node_number}`}
        >
          <X className={cn(iconSize)} />
        </button>
      )}
    </div>
  );
}
