'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/app/lib/utils';
import { RARITY_TIERS } from './use-rarity-filter';

interface RarityFilterTogglesProps {
  activeTiers: Set<string>;
  onToggle: (tier: string) => void;
  /** Short label shown before the pills (e.g. "Rank"). */
  label: string;
  /** data-cy prefix per pill, e.g. "war-attacker-rarity" → "war-attacker-rarity-7r5". */
  cyPrefix: string;
}

/** Compact pill row of rarity-tier toggles, visually grouped 6★ | 7★. */
export default function RarityFilterToggles({
  activeTiers,
  onToggle,
  label,
  cyPrefix,
}: Readonly<RarityFilterTogglesProps>) {
  return (
    <div className='flex flex-wrap items-center gap-1'>
      <span className='mr-1 text-[11px] font-medium text-muted-foreground'>{label}</span>
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
              data-cy={`${cyPrefix}-${tier}`}
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
