'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/app/lib/utils';
import { RARITY_TIERS } from './use-attacker-rarity-filter';

interface RarityFilterTogglesProps {
  activeTiers: Set<string>;
  onToggle: (tier: string) => void;
}

/** Compact pill row of rarity-tier toggles, visually grouped 6★ | 7★. */
export default function RarityFilterToggles({
  activeTiers,
  onToggle,
}: Readonly<RarityFilterTogglesProps>) {
  const { t } = useI18n();

  return (
    <div className='flex flex-wrap items-center gap-1'>
      <span className='mr-1 text-[11px] font-medium text-muted-foreground'>
        {t.game.war.rankFilter}
      </span>
      {RARITY_TIERS.map((tier, i) => {
        const active = activeTiers.has(tier);
        // Small gap between the 6★ block and the 7★ block.
        const startsSevenStar = tier === '7r1';
        return (
          <span
            key={tier}
            className={cn(startsSevenStar && i > 0 && 'ml-2')}
          >
            <Button
              variant='outline'
              size='sm'
              data-cy={`war-attacker-rarity-${tier}`}
              aria-pressed={active}
              className={cn(
                'h-7 px-2 text-[11px] font-mono',
                active && 'bg-primary/10 border-primary text-primary'
              )}
              onClick={() => onToggle(tier)}
            >
              {tier}
            </Button>
          </span>
        );
      })}
    </div>
  );
}
