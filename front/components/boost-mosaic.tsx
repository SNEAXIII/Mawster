'use client'

import {
  BatteryCharging,
  HeartPulse,
  ShieldCheck,
  ShieldHalf,
  Swords,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import type { WarBoost, WarBoosts } from '@/app/services/war'

// Placeholders until the real assets land — see the note in static-assets/static/icons/
const BOOST_ICONS: Record<WarBoost, LucideIcon> = {
  power_start: Zap,
  invulnerability: ShieldCheck,
  regeneration: HeartPulse,
}

type Cell = { key: string; Icon: LucideIcon; label: string } | null

interface BoostMosaicProps {
  boosts: WarBoosts
  nodeNumber: number
  className?: string
}

export default function BoostMosaic({ boosts, nodeNumber, className }: BoostMosaicProps) {
  const { t } = useI18n()

  // The exclusive slot always holds cell 0 so icon positions never shift between nodes.
  const cells: Cell[] = [
    boosts.war_boost
      ? {
          key: boosts.war_boost,
          Icon: BOOST_ICONS[boosts.war_boost],
          label: t.game.war.boosts[boosts.war_boost],
        }
      : null,
    boosts.has_defense_boost
      ? { key: 'defense', Icon: ShieldHalf, label: t.game.war.boosts.defense }
      : null,
    boosts.has_power_boost
      ? { key: 'power', Icon: BatteryCharging, label: t.game.war.boosts.power }
      : null,
    boosts.has_specials_boost
      ? { key: 'specials', Icon: Swords, label: t.game.war.boosts.specials }
      : null,
  ]

  if (cells.every((cell) => cell === null)) return null

  return (
    <div
      className={cn('grid grid-cols-2 gap-px', className)}
      data-cy={`war-node-boosts-${nodeNumber}`}
      aria-label={t.game.war.boosts.title}
    >
      {cells.map((cell, index) =>
        cell ? (
          <span
            key={cell.key}
            title={cell.label}
            data-cy={`war-node-boost-${cell.key}-${nodeNumber}`}
            className='flex size-3 items-center justify-center rounded-xs bg-card/80 text-muted-foreground'
          >
            <cell.Icon
              className='size-2.5'
              aria-hidden
            />
          </span>
        ) : (
          <span
            key={`empty-${index}`}
            className='size-3'
            aria-hidden
          />
        )
      )}
    </div>
  )
}
