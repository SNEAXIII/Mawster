'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X, Minus, Plus, Swords, CircleQuestionMark } from 'lucide-react';
import { type WarPlacement } from '@/app/services/war';
import { useWar } from '@/app/contexts/war-context';
import PrefightPopover from './prefight-popover';

interface AttackerEntryRowProps {
  placement: WarPlacement;
  /** compact: small portraits, hollow frames, no labels — full: large portraits, star frames, player name + node */
  mode?: 'compact' | 'full';
  /** readonly: hides KO controls and remove button */
  readonly?: boolean;
}

export default function AttackerEntryRow({ placement, mode = 'compact', readonly = false }: Readonly<AttackerEntryRowProps>) {
  const { t } = useI18n();
  const { handleRemoveAttacker, handleUpdateKo, prefights } = useWar();
  const nodePrefights = prefights.filter((p) => p.target_node_number === placement.node_number);

  const isFull = mode === 'full';
  const portraitSize = isFull ? 55 : 40;
  const btnSize = isFull ? 'w-7 h-7' : 'w-5 h-5';
  const iconSize = isFull ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  const swordsSize = isFull ? 'w-6 h-6' : 'w-3 h-3';
  const boxPaddingSize = isFull ? 'px-7 py-2' : 'px-2 py-1.5';

  return (
    <div
      className={cn('flex items-center gap-2 rounded-md bg-card', boxPaddingSize, !isFull && 'border')}
      data-cy={`attacker-entry-node-${placement.node_number}`}
      data-attacker={placement.attacker_champion_name ?? ''}
    >
      <div className='flex items-center gap-1 shrink-0'>
        {placement.attacker_champion_user_id && !readonly ? (
          <PrefightPopover
            nodeNumber={placement.node_number}
            gameAccountId={placement.attacker_game_account_id ?? ''}
            championName={placement.attacker_champion_name ?? ''}
            imageUrl={placement.attacker_image_url}
            rarity={placement.attacker_rarity ?? ''}
            size={portraitSize}
            isPreferred={placement.attacker_is_preferred_attacker ?? false}
          />
        ) : placement.attacker_image_url ? (
          <ChampionPortrait
            imageUrl={placement.attacker_image_url}
            name={placement.attacker_champion_name ?? ''}
            rarity={placement.attacker_rarity ?? ''}
            size={portraitSize}
            isPreferred={placement.attacker_is_preferred_attacker ?? false}
          />
        ) : (
          <div
            className='rounded shrink-0 bg-muted border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground/60'
            style={{ width: portraitSize-8, height: portraitSize-8 }}
          >
            <CircleQuestionMark className={swordsSize} />
          </div>
        )}
        <Swords className={cn('text-muted-foreground shrink-0', swordsSize)} />
        <ChampionPortrait
          imageUrl={placement.image_url}
          name={placement.champion_name}
          rarity={placement.rarity}
          size={portraitSize}
        />
        {nodePrefights.map((p) => (
          <div key={p.champion_user_id} className='relative' title={t.game.war.prefight.tooltip}>
            <ChampionPortrait
              imageUrl={p.image_url}
              name={p.champion_name}
              rarity={p.rarity}
              size={portraitSize}
              mode='prefight'
            />
          </div>
        ))}
      </div>

      <div className='flex-1 min-w-0'>
        {isFull && placement.attacker_pseudo && (
          <div className='text-[10px] font-semibold truncate'>{placement.attacker_pseudo}</div>
        )}
        <div className='text-[10px] text-muted-foreground'>#{placement.node_number}</div>
      </div>

      {placement.attacker_champion_user_id && readonly && (
        <span className={cn('font-mono text-sm text-muted-foreground', isFull ? 'text-sm' : 'text-xs')}>
          {placement.ko_count} KO
        </span>
      )}
      {placement.attacker_champion_user_id && !readonly && (
        <>
          <div
            className='flex items-center gap-1'
            data-cy={`ko-counter-node-${placement.node_number}`}
          >
            <button
              type='button'
              className={cn(
                'rounded flex items-center justify-center text-xs',
                'bg-muted hover:bg-accent transition-colors',
                btnSize,
                placement.ko_count <= 0 && 'opacity-40 cursor-not-allowed'
              )}
              onClick={() =>
                placement.ko_count > 0 && handleUpdateKo(placement.node_number, placement.ko_count - 1)
              }
              disabled={placement.ko_count <= 0}
              data-cy={`ko-dec-node-${placement.node_number}`}
            >
              <Minus className={cn(iconSize)} />
            </button>
            <span
              className={cn('font-mono text-center', isFull ? 'text-sm w-5' : 'text-xs w-4')}
              data-cy={`ko-value-node-${placement.node_number}`}
            >
              {placement.ko_count}
            </span>
            <button
              type='button'
              className={cn(
                'rounded flex items-center justify-center text-xs bg-muted hover:bg-accent transition-colors',
                btnSize
              )}
              onClick={() => handleUpdateKo(placement.node_number, placement.ko_count + 1)}
              data-cy={`ko-inc-node-${placement.node_number}`}
            >
              <Plus className={cn(iconSize)} />
            </button>
          </div>

          <button
            type='button'
            className={cn(
              'rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center flex-shrink-0',
              btnSize
            )}
            onClick={() => handleRemoveAttacker(placement.node_number)}
            title={t.game.war.removeAttacker}
            data-cy={`remove-attacker-node-${placement.node_number}`}
          >
            <X className={cn(iconSize)} />
          </button>
        </>
      )}
    </div>
  );
}
