'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X, Minus, Plus, Swords } from 'lucide-react';
import { type WarPlacement } from '@/app/services/war';
import { useWar } from '../_context/war-context';

export default function AttackerEntryRow({ placement }: { placement: WarPlacement }) {
  const { t } = useI18n();
  const { handleRemoveAttacker, handleUpdateKo } = useWar();

  return (
    <div
      className='flex items-center gap-2 rounded-md border bg-card px-2 py-1.5'
      data-cy={`attacker-entry-node-${placement.node_number}`}
    >
      <div className='flex items-center gap-1 flex-shrink-0'>
        <ChampionPortrait
          imageUrl={placement.attacker_image_url}
          name={placement.attacker_champion_name ?? ''}
          rarity={placement.attacker_rarity ?? '7r3'}
          size={35}
        />
        <Swords className='w-4 h-4 text-muted-foreground flex-shrink-0' />
        <ChampionPortrait
          imageUrl={placement.image_url}
          name={placement.champion_name}
          rarity={placement.rarity}
          size={35}
        />
      </div>

      <div className='flex-1 min-w-0'>
        <div className='text-[10px] text-muted-foreground'>#{placement.node_number}</div>
      </div>

      <div
        className='flex items-center gap-1'
        data-cy={`ko-counter-node-${placement.node_number}`}
      >
        <button
          type='button'
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs',
            'bg-muted hover:bg-accent transition-colors',
            placement.ko_count <= 0 && 'opacity-40 cursor-not-allowed'
          )}
          onClick={() =>
            placement.ko_count > 0 && handleUpdateKo(placement.node_number, placement.ko_count - 1)
          }
          disabled={placement.ko_count <= 0}
          data-cy={`ko-dec-node-${placement.node_number}`}
        >
          <Minus className='w-2.5 h-2.5' />
        </button>
        <span
          className='text-xs font-mono w-4 text-center'
          data-cy={`ko-value-node-${placement.node_number}`}
        >
          {placement.ko_count}
        </span>
        <button
          type='button'
          className='w-5 h-5 rounded flex items-center justify-center text-xs bg-muted hover:bg-accent transition-colors'
          onClick={() => handleUpdateKo(placement.node_number, placement.ko_count + 1)}
          data-cy={`ko-inc-node-${placement.node_number}`}
        >
          <Plus className='w-2.5 h-2.5' />
        </button>
      </div>

      <button
        type='button'
        className='w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center flex-shrink-0'
        onClick={() => handleRemoveAttacker(placement.node_number)}
        title={t.game.war.removeAttacker}
        data-cy={`remove-attacker-node-${placement.node_number}`}
      >
        <X className='w-2.5 h-2.5' />
      </button>
    </div>
  );
}
