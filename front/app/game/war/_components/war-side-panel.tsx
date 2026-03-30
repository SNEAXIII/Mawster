'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X } from 'lucide-react';
import { rarityBadgeClass, rarityLabel } from '@/app/game/defense/_components/defense-utils';
import { useWar } from '../_context/war-context';

export default function WarSidePanel() {
  const { t } = useI18n();
  const { placements, handleRemoveDefender, canManageWar } = useWar();

  const sorted = [...placements].sort((a, b) => a.node_number - b.node_number);

  return (
    <div className='flex flex-col gap-2'>
      <div className='text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1'>
        {t.game.defense.defendersPlaced} ({placements.length})
      </div>

      {sorted.length === 0 ? (
        <div className='text-sm text-muted-foreground px-1'>{t.game.defense.noDefendersPlaced}</div>
      ) : (
        <div className='flex flex-wrap gap-1.5'>
          {sorted.map((p) => (
            <div
              key={p.id}
              className='relative group flex flex-col items-center'
              title={`Node #${p.node_number} — ${p.champion_name}`}
              data-cy={`war-defender-card-${p.node_number}`}
            >
              <ChampionPortrait
                imageUrl={p.image_url}
                name={p.champion_name}
                rarity={p.rarity}
                size={40}
              />
              <span className='text-[10px] text-white/80'>#{p.node_number}</span>
              <span
                className={cn('text-[10px] font-mono leading-none', rarityBadgeClass(p.rarity))}
              >
                {rarityLabel(p.rarity, 0, p.ascension)}
              </span>
              {canManageWar && (
                <button
                  className='absolute -top-1 -right-1 z-10 hidden group-hover:flex bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 items-center justify-center'
                  onClick={() => handleRemoveDefender(p.node_number)}
                  title={t.game.war.removeDefender}
                >
                  <X className='w-2.5 h-2.5' />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
