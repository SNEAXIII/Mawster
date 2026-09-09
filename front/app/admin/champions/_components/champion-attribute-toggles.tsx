'use client'

import { cn } from '@/app/lib/utils'
import type { Champion } from '@/app/services/champions'
import {
  CHAMPION_ATTRIBUTES,
  attributeCy,
  useChampionAttributeLabels,
  type ChampionAttribute,
} from '@/app/admin/_viewmodels/champion-attributes'

interface ChampionAttributeTogglesProps {
  champion: Champion
  sagaDisabled?: boolean
  onToggle: (champion: Champion, attribute: ChampionAttribute) => void
}

export default function ChampionAttributeToggles({
  champion,
  sagaDisabled,
  onToggle,
}: Readonly<ChampionAttributeTogglesProps>) {
  const labels = useChampionAttributeLabels()

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {CHAMPION_ATTRIBUTES.map(({ key, name, icon, requiresSeason }) => {
        const active = champion[key]
        const disabled = sagaDisabled && requiresSeason
        return (
          <button
            key={key}
            type='button'
            onClick={() => onToggle(champion, key)}
            disabled={disabled}
            aria-pressed={active}
            aria-label={labels[key]}
            title={labels[key]}
            data-cy={`champion-attr-${attributeCy(name)}-${champion.name}`}
            className={cn(
              'flex size-8 items-center justify-center rounded transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-30',
              active ? 'bg-primary/15 hover:bg-primary/25' : 'bg-muted hover:bg-muted/80'
            )}
          >
            <img
              src={icon}
              alt=''
              className={cn(
                'h-5 w-5 object-contain transition-[filter,opacity]',
                // Dimmed rather than hidden, so an inactive attribute keeps its slot
                // instead of shifting the row's icons around.
                active ? 'opacity-100' : 'opacity-40 grayscale'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
