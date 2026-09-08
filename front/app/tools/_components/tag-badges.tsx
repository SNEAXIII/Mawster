'use client'

import { Flame, Gem, Shield, Swords, Trophy } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { ChampionTags } from '../_lib/types'

/**
 * The marks a champion carries, as small chips under its portrait.
 *
 * Attacker and defender collapse into a single "dual threat" chip when both are
 * set: three chips saying the same thing is noise, and the pairing is what the
 * player actually reads.
 */
interface TagBadgesProps {
  tags: ChampionTags
  /** Chip size in px, derived from the card size so badges scale with it. */
  size: number
  className?: string
}

const CHIP = 'inline-flex items-center gap-0.5 rounded px-1 font-bold leading-none'

export default function TagBadges({ tags, size, className }: Readonly<TagBadgesProps>) {
  const dual = tags.is_attacker && tags.is_defender
  const iconSize = Math.max(8, size)

  const chips: { key: string; label: string; icon: React.ReactNode; tone: string }[] = []

  if (dual) {
    chips.push({
      key: 'dual',
      label: '',
      icon: <Swords style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-violet-500/90 text-white',
    })
  } else if (tags.is_attacker) {
    chips.push({
      key: 'attacker',
      label: '',
      icon: <Swords style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-rose-500/90 text-white',
    })
  } else if (tags.is_defender) {
    chips.push({
      key: 'defender',
      label: '',
      icon: <Shield style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-sky-500/90 text-white',
    })
  }

  if (tags.is_alliance_war) {
    chips.push({
      key: 'aw',
      label: '',
      icon: <Flame style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-amber-500/90 text-black',
    })
  }
  if (tags.is_battlegrounds) {
    chips.push({
      key: 'bg',
      label: '',
      icon: <Trophy style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-green-500/90 text-black',
    })
  }
  if (tags.is_awakened) {
    chips.push({
      key: 'awk',
      // The signature value is the point of the awakened mark, so it is spelled
      // out rather than left to a tooltip nobody opens on a phone.
      label: tags.signature > 0 ? `${tags.signature}` : '',
      icon: <Gem style={{ width: iconSize, height: iconSize }} />,
      tone: 'bg-cyan-400 text-black',
    })
  }

  if (chips.length === 0) return null

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-0.5', className)}
      style={{ fontSize: Math.max(7, size * 0.9) }}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(CHIP, chip.tone)}
        >
          {chip.icon}
          {chip.label}
        </span>
      ))}
    </div>
  )
}
