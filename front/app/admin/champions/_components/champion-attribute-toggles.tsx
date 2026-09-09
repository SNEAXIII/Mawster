'use client'

import { cn } from '@/app/lib/utils'
import { useI18n } from '@/app/i18n'
import type { Champion } from '@/app/services/champions'
import type { ChampionAttribute } from '@/app/admin/_viewmodels/champion-filters'

interface ChampionAttributeTogglesProps {
  champion: Champion
  sagaDisabled?: boolean
  onToggle: (champion: Champion, attribute: ChampionAttribute) => void
}

const SAGA_ATTRIBUTES: ChampionAttribute[] = ['is_saga_attacker', 'is_saga_defender']

export default function ChampionAttributeToggles({
  champion,
  sagaDisabled,
  onToggle,
}: Readonly<ChampionAttributeTogglesProps>) {
  const { t } = useI18n()

  const attributes: { key: ChampionAttribute; label: string; cy: string }[] = [
    { key: 'is_7_stars_available', label: t.champions.attributes.sevenStars, cy: 'seven-stars' },
    { key: 'is_ascendable', label: t.champions.attributes.ascendable, cy: 'ascendable' },
    { key: 'has_prefight', label: t.champions.attributes.prefight, cy: 'prefight' },
    { key: 'is_saga_attacker', label: t.champions.attributes.sagaAttacker, cy: 'saga-attacker' },
    { key: 'is_saga_defender', label: t.champions.attributes.sagaDefender, cy: 'saga-defender' },
  ]

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {attributes.map(({ key, label, cy }) => {
        const active = champion[key]
        const disabled = sagaDisabled && SAGA_ATTRIBUTES.includes(key)
        return (
          <button
            key={key}
            type='button'
            onClick={() => onToggle(champion, key)}
            disabled={disabled}
            aria-pressed={active}
            title={label}
            data-cy={`champion-attr-${cy}-${champion.name}`}
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'bg-muted text-muted-foreground/70 hover:bg-muted/80'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
