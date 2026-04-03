'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ChampionPortrait from '@/components/champion-portrait';
import SynergyBadge from './synergy-badge';
import SynergySelectorDialog from './synergy-selector';
import { useWar } from '../_context/war-context';

interface SynergyPopoverProps {
  /** The node attacker champion (target that benefits from synergy) */
  championUserId: string;
  gameAccountId: string;
  championName: string;
  imageUrl: string | null;
  rarity: string;
  size?: number;
}

export default function SynergyPopover({
  championUserId,
  gameAccountId,
  championName,
  imageUrl,
  rarity,
  size = 35,
}: Readonly<SynergyPopoverProps>) {
  const { t } = useI18n();
  const { synergies, handleRemoveSynergy } = useWar();
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const boundSynergies = synergies.filter((s) => s.target_champion_user_id === championUserId);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            className='relative focus:outline-none'
            data-cy={`synergy-trigger-${championName.replaceAll(/\s+/g, '-')}`}
          >
            <ChampionPortrait
              imageUrl={imageUrl}
              name={championName}
              rarity={rarity}
              size={size}
            />
            {boundSynergies.length > 0 && (
              <SynergyBadge targetChampionName={championName} className='z' />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-52 p-3 space-y-2'
          side='top'
        >
          <p className='text-[11px] font-semibold truncate'>{championName}</p>
          {boundSynergies.length > 0 && (
            <div className='space-y-1'>
              <p className='text-[10px] text-muted-foreground'>{t.game.war.synergy.label}</p>
              {boundSynergies.map((s) => (
                <div
                  key={s.champion_user_id}
                  className='flex items-center gap-2'
                >
                  <ChampionPortrait
                    imageUrl={s.image_url}
                    name={s.champion_name}
                    rarity={s.rarity}
                    size={32}
                  />
                  <span className='text-xs font-medium truncate flex-1'>{s.champion_name}</span>
                  <button
                    className='shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors'
                    data-cy={`synergy-revoke-${s.champion_name.replaceAll(/\s+/g, '-')}`}
                    onClick={async () => {
                      setOpen(false);
                      await handleRemoveSynergy(s.champion_user_id);
                    }}
                  >
                    {t.game.war.synergy.revoke}
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
            data-cy={`synergy-add-${championName.replaceAll(/\s+/g, '-')}`}
            onClick={() => {
              setOpen(false);
              setSelectorOpen(true);
            }}
          >
            {t.game.war.synergy.add}
          </button>
        </PopoverContent>
      </Popover>
      <SynergySelectorDialog
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        targetChampionUserId={championUserId}
        targetGameAccountId={gameAccountId}
        targetChampionName={championName}
      />
    </>
  );
}
