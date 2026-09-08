'use client'

import { cn } from '@/app/lib/utils'
import { DUAL_ICON, TAG_ICON } from '../_lib/tags'
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

interface Chip {
  key: string
  src: string
  /** Printed next to the glyph — only the signature value does that. */
  label?: string
}

function chipsFor(tags: ChampionTags): Chip[] {
  const chips: Chip[] = []
  if (tags.is_attacker && tags.is_defender) {
    chips.push({ key: 'dual', src: DUAL_ICON })
  } else if (tags.is_attacker) {
    chips.push({ key: 'attacker', src: TAG_ICON.is_attacker })
  } else if (tags.is_defender) {
    chips.push({ key: 'defender', src: TAG_ICON.is_defender })
  }
  if (tags.is_alliance_war) {
    chips.push({ key: 'aw', src: TAG_ICON.is_alliance_war })
  }
  if (tags.is_battlegrounds) {
    chips.push({ key: 'bg', src: TAG_ICON.is_battlegrounds })
  }
  if (tags.is_awakened) {
    chips.push({
      key: 'awk',
      src: TAG_ICON.is_awakened,
      // The signature value is the point of the awakened mark, so it is spelled
      // out rather than left to a tooltip nobody opens on a phone.
      label: tags.signature > 0 ? String(tags.signature) : undefined,
    })
  }
  return chips
}

export default function TagBadges({ tags, size, className }: Readonly<TagBadgesProps>) {
  const chips = chipsFor(tags)
  if (chips.length === 0) return null
  const glyph = Math.max(12, size)

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-0.5', className)}
      style={{ fontSize: Math.max(9, size * 0.55) }}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          data-cy={`tierlist-badge-${chip.key}`}
          className={cn(
            'inline-flex items-center rounded bg-slate-950/85 font-bold text-white',
            // Padding only where a number sits next to the glyph: around a bare
            // icon it just shrinks the artwork inside its own chip.
            chip.label ? 'gap-0.5 pr-1 pl-0.5' : 'p-0'
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
