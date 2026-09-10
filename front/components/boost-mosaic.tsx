'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import type { WarBoost, WarBoosts } from '@/app/services/war'

import {
  BoostFlaskIcon,
  BoostHeartArrowIcon,
  BoostShieldIcon,
  BoostShieldSparkIcon,
  BoostSnowflakeIcon,
  BoostSunburstIcon,
  type BoostIcon,
} from '@/components/boost-icons'

type BoostKey = WarBoost | 'defense' | 'power' | 'specials'

// Every icon in one place: one edit covers the war map and the knowledge base.
const BOOST_ICONS: Record<BoostKey, BoostIcon> = {
  power_start: BoostFlaskIcon,
  invulnerability: BoostShieldIcon,
  regeneration: BoostHeartArrowIcon,
  defense: BoostShieldSparkIcon,
  power: BoostSnowflakeIcon,
  specials: BoostSunburstIcon,
}

type Cell = { key: BoostKey; label: string } | null

function BoostCell({
  entry,
  nodeNumber,
}: Readonly<{ entry: NonNullable<Cell>; nodeNumber: number }>) {
  const Icon = BOOST_ICONS[entry.key]
  return (
    <span
      title={entry.label}
      data-cy={`war-node-boost-${entry.key}-${nodeNumber}`}
      className='flex size-5 items-center justify-center rounded-xs bg-card/80 text-muted-foreground'
    >
      <Icon
        className='size-4'
        aria-hidden
      />
    </span>
  )
}

interface BoostMosaicProps {
  boosts: WarBoosts
  nodeNumber: number
  className?: string
}

export default function BoostMosaic({ boosts, nodeNumber, className }: BoostMosaicProps) {
  const { t } = useI18n()

  // The exclusive slot always holds cell 0 so icon positions never shift between nodes.
  const cell = (key: BoostKey, active: boolean): Cell =>
    active ? { key, label: t.game.war.boosts[key] } : null

  const cells: Cell[] = [
    boosts.war_boost ? cell(boosts.war_boost, true) : null,
    cell('defense', boosts.has_defense_boost),
    cell('power', boosts.has_power_boost),
    cell('specials', boosts.has_specials_boost),
  ]

  if (cells.every((cell) => cell === null)) return null

  return (
    <div
      className={cn('grid grid-cols-2 gap-px', className)}
      data-cy={`war-node-boosts-${nodeNumber}`}
      aria-label={t.game.war.boosts.title}
    >
      {cells.map((entry, index) =>
        entry ? (
          <BoostCell
            key={entry.key}
            entry={entry}
            nodeNumber={nodeNumber}
          />
        ) : (
          <span
            key={`empty-${index}`}
            className='size-5'
            aria-hidden
          />
        )
      )}
    </div>
  )
}
