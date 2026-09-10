'use client'

import { Sparkles } from 'lucide-react'

import { useWar } from '@/app/contexts/war-context'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import type { WarBoost, WarBoosts, WarPlacement } from '@/app/services/war'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import BoostMosaic from '@/components/boost-mosaic'

const EXCLUSIVE: WarBoost[] = ['power_start', 'invulnerability', 'regeneration']
const STACKABLE = ['has_defense_boost', 'has_power_boost', 'has_specials_boost'] as const

const STACKABLE_LABEL_KEY = {
  has_defense_boost: 'defense',
  has_power_boost: 'power',
  has_specials_boost: 'specials',
} as const

interface BoostPopoverProps {
  placement: WarPlacement
  canManage: boolean
}

export default function BoostPopover({ placement, canManage }: Readonly<BoostPopoverProps>) {
  const { t } = useI18n()
  const { handleUpdateBoosts } = useWar()
  const node = placement.node_number

  const current: WarBoosts = {
    war_boost: placement.war_boost,
    has_defense_boost: placement.has_defense_boost,
    has_power_boost: placement.has_power_boost,
    has_specials_boost: placement.has_specials_boost,
  }

  if (!canManage)
    return (
      <BoostMosaic
        boosts={current}
        nodeNumber={node}
      />
    )

  // Re-picking the active one clears it, so a boost can be undone without a reset button.
  const pickExclusive = (boost: WarBoost) =>
    handleUpdateBoosts(node, { ...current, war_boost: current.war_boost === boost ? null : boost })

  const toggleStackable = (key: (typeof STACKABLE)[number]) =>
    handleUpdateBoosts(node, { ...current, [key]: !current[key] })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='flex shrink-0 items-center rounded p-0.5 transition-colors hover:bg-accent'
          title={t.game.war.boosts.title}
          data-cy={`boost-trigger-node-${node}`}
        >
          {placement.war_boost ||
          placement.has_defense_boost ||
          placement.has_power_boost ||
          placement.has_specials_boost ? (
            <BoostMosaic
              boosts={current}
              nodeNumber={node}
            />
          ) : (
            <Sparkles className='size-3 text-muted-foreground/50' />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-64 space-y-2 p-2'
        data-cy={`boost-popover-node-${node}`}
      >
        <p className='text-[10px] text-muted-foreground'>{t.game.war.boosts.exclusiveHint}</p>
        <div className='space-y-1'>
          {EXCLUSIVE.map((boost) => (
            <button
              key={boost}
              type='button'
              onClick={() => pickExclusive(boost)}
              data-cy={`boost-option-${boost}-node-${node}`}
              className={cn(
                'w-full rounded px-2 py-1 text-left text-xs transition-colors',
                current.war_boost === boost
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {t.game.war.boosts[boost]}
            </button>
          ))}
        </div>
        <div className='space-y-1 border-t pt-2'>
          {STACKABLE.map((key) => (
            <button
              key={key}
              type='button'
              onClick={() => toggleStackable(key)}
              data-cy={`boost-option-${STACKABLE_LABEL_KEY[key]}-node-${node}`}
              className={cn(
                'w-full rounded px-2 py-1 text-left text-xs transition-colors',
                current[key] ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              )}
            >
              {t.game.war.boosts[STACKABLE_LABEL_KEY[key]]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
