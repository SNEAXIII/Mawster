'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ChampionPortrait from '@/components/champion-portrait';
import PrefightSelectorDialog from './prefight-selector';
import { useWar } from '@/app/contexts/war-context';

interface PrefightPopoverProps {
  nodeNumber: number;
  gameAccountId: string;
  championName: string;
  imageUrl: string | null;
  rarity: string;
  size?: number;
  isPreferred?: boolean;
}

export default function PrefightPopover({
  nodeNumber,
  gameAccountId,
  championName,
  imageUrl,
  rarity,
  size = 35,
  isPreferred = false,
}: Readonly<PrefightPopoverProps>) {
  const { t } = useI18n();
  const { prefights, handleRemovePrefight } = useWar();
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // prefights targeting this specific node
  const boundPrefights = prefights.filter((p) => p.target_node_number === nodeNumber);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className='relative focus:outline-none'
            data-cy={`prefight-trigger-node-${nodeNumber}`}
          >
            <ChampionPortrait
              imageUrl={imageUrl}
              name={championName}
              rarity={rarity}
              size={size}
              isPreferred={isPreferred}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-52 p-3 space-y-2' side='top'>
          <p className='text-[11px] font-semibold truncate'>#{nodeNumber} — {championName}</p>
          {boundPrefights.length > 0 && (
            <div className='space-y-1'>
              <p className='text-[10px] text-muted-foreground'>{t.game.war.prefight.label}</p>
              {boundPrefights.map((p) => (
                <div key={p.champion_user_id} className='flex items-center gap-2'>
                  <ChampionPortrait
                    imageUrl={p.image_url}
                    name={p.champion_name}
                    rarity={p.rarity}
                    size={32}
                  />
                  <div className='flex flex-col flex-1 min-w-0'>
                    <span className='text-xs font-medium truncate'>{p.champion_name}</span>
                    <span className='text-[10px] text-muted-foreground truncate'>{p.game_pseudo}</span>
                  </div>
                  <button
                    className='shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors'
                    data-cy={`prefight-revoke-${p.champion_name.replaceAll(/\s+/g, '-')}`}
                    onClick={async () => {
                      setOpen(false);
                      await handleRemovePrefight(p.champion_user_id);
                    }}
                  >
                    {t.game.war.prefight.revoke}
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
            data-cy={`prefight-add-node-${nodeNumber}`}
            onClick={() => { setOpen(false); setSelectorOpen(true); }}
          >
            {t.game.war.prefight.add}
          </button>
        </PopoverContent>
      </Popover>

      <PrefightSelectorDialog
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        targetNodeNumber={nodeNumber}
        targetGameAccountId={gameAccountId}
      />
    </>
  );
}
