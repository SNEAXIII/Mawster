'use client'

import { cn } from '@/app/lib/utils'
import type { ChampionTags } from '../_lib/types'

/**
 * The marks a champion carries, as small chips under its portrait.
 *
 * Attacker and defender collapse into a single "dual threat" chip when both are
 * set: three chips saying the same thing is noise, and the pairing is what the
 * player actually reads.
 *
 * The glyphs are the game's own artwork, served next to the portraits and the
 * star frames — a generic sword icon next to in-game art reads as a placeholder.
 */
interface TagBadgesProps {
  tags: ChampionTags
  /** Chip size in px, derived from the card size so badges scale with it. */
  size: number
  className?: string
}

/** Where each marker's artwork lives on the static host. */
const ICON_URL = {
  attacker: '/static/icons/atk-sword.png',
  defender: '/static/icons/def-shield.png',
  dual: '/static/icons/dual-sword-shield.png',
  allianceWar: '/static/icons/aw-flame.png',
  battlegrounds: '/static/icons/bg-helmet.png',
  awakened: '/static/icons/awk-gem.png',
} as const

interface Chip {
  key: string
  src: string
  /** Printed next to the glyph — only the signature value does that. */
  label?: string
  tone: string
}

function chipsFor(tags: ChampionTags): Chip[] {
  const chips: Chip[] = []
  if (tags.is_attacker && tags.is_defender) {
    chips.push({ key: 'dual', src: ICON_URL.dual, tone: 'ring-violet-400/70' })
  } else if (tags.is_attacker) {
    chips.push({ key: 'attacker', src: ICON_URL.attacker, tone: 'ring-rose-400/70' })
  } else if (tags.is_defender) {
    chips.push({ key: 'defender', src: ICON_URL.defender, tone: 'ring-sky-400/70' })
  }
  if (tags.is_alliance_war) {
    chips.push({ key: 'aw', src: ICON_URL.allianceWar, tone: 'ring-amber-400/70' })
  }
  if (tags.is_battlegrounds) {
    chips.push({ key: 'bg', src: ICON_URL.battlegrounds, tone: 'ring-emerald-400/70' })
  }
  if (tags.is_awakened) {
    chips.push({
      key: 'awk',
      src: ICON_URL.awakened,
      // The signature value is the point of the awakened mark, so it is spelled
      // out rather than left to a tooltip nobody opens on a phone.
      label: tags.signature > 0 ? String(tags.signature) : undefined,
      tone: 'ring-cyan-300/70',
    })
  }
  return chips
}

export default function TagBadges({ tags, size, className }: Readonly<TagBadgesProps>) {
  const chips = chipsFor(tags)
  if (chips.length === 0) return null
  const glyph = Math.max(8, size)

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-0.5', className)}
      style={{ fontSize: Math.max(7, size * 0.9) }}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            'inline-flex items-center gap-0.5 rounded bg-slate-950/85 px-1 font-bold text-white ring-1',
            chip.tone
          )}
        >
          <img
            src={chip.src}
            alt=''
            style={{ width: glyph, height: glyph }}
            className='object-contain'
          />
          {chip.label}
        </span>
      ))}
    </div>
  )
}
