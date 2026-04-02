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
  championName: string;
  imageUrl: string | null;
  rarity: string;
  size?: number;
}

export default function SynergyPopover({
  championUserId,
  championName,
  imageUrl,
  rarity,
  size = 35,
}: Readonly<SynergyPopoverProps>) {
  const { t } = useI18n();
  const { synergies, handleRemoveSynergy } = useWar();
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const boundSynergy = synergies.find((s) => s.target_champion_user_id === championUserId);

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
            {boundSynergy && (
              <SynergyBadge targetChampionName={championName} />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-52 p-3 space-y-2'
          side='top'
        >
          <p className='text-[11px] font-semibold truncate'>{championName}</p>
          {boundSynergy ? (
            <div className='space-y-2'>
              <p className='text-[10px] text-muted-foreground'>{t.game.war.synergy.label}</p>
              <div className='flex items-center gap-2'>
                <ChampionPortrait
                  imageUrl={boundSynergy.image_url}
                  name={boundSynergy.champion_name}
                  rarity={boundSynergy.rarity}
                  size={36}
                />
                <span className='text-xs font-medium truncate'>{boundSynergy.champion_name}</span>
              </div>
              <button
                className='w-full text-xs py-1 px-2 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors'
                data-cy={`synergy-revoke-${championName.replaceAll(/\s+/g, '-')}`}
                onClick={async () => {
                  setOpen(false);
                  await handleRemoveSynergy(boundSynergy.champion_user_id);
                }}
              >
                {t.game.war.synergy.revoke}
              </button>
            </div>
          ) : (
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
          )}
        </PopoverContent>
      </Popover>

      <SynergySelectorDialog
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        targetChampionUserId={championUserId}
        targetChampionName={championName}
      />
    </>
  );
}
