'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ChampionPortrait from '@/components/champion-portrait'
import { cn } from '@/app/lib/utils'
import TagBadges from './tag-badges'
import type { CatalogChampion, ChampionTags } from '../_lib/types'

export interface ChampionCardProps {
  champion: CatalogChampion
  tags: ChampionTags
  size: number
  showName: boolean
  showBadges: boolean
  onOpen?: (championId: string) => void
}

/**
 * Which star frame a champion is drawn in. Rarity is a property of the champion,
 * not a display toggle: one with no 7-star version always shows the 6-star frame.
 * The tag is the editable source, `is_7_star` the catalog's answer.
 */
function frameRarity(champion: CatalogChampion, tags: ChampionTags): string {
  return tags.is_six_star_only || !champion.is_7_star ? '6r1' : '7r1'
}

/** Portrait, chips and (optionally) the name — the visual only, no drag wiring. */
export function ChampionCardVisual({
  champion,
  tags,
  size,
  showName,
  showBadges,
}: Readonly<Omit<ChampionCardProps, 'onOpen'>>) {
  return (
    <div
      className='flex flex-col items-center'
      style={{ width: size }}
    >
      <ChampionPortrait
        imageUrl={champion.image_url}
        name={champion.name}
        rarity={frameRarity(champion, tags)}
        size={size}
        box='frame'
        is_saga_attacker={champion.is_saga_attacker}
        is_saga_defender={champion.is_saga_defender}
        sagaMode='all'
      />
      {/* Chips sit below the portrait rather than over it — overlaid, they hid
          the very artwork the card exists to show. */}
      {showBadges && (
        <TagBadges
          tags={tags}
          size={Math.max(9, size * 0.17)}
          className='mt-0.5'
        />
      )}
      {showName && (
        <span
          className='mt-1 w-full truncate text-center leading-tight text-muted-foreground'
          style={{ fontSize: Math.max(8, size * 0.14) }}
          title={champion.name}
        >
          {champion.name}
        </span>
      )}
    </div>
  )
}

/**
 * A champion in the pool or in a row: draggable, and clickable to open its tag
 * sheet. Memoised because one keystroke in the search box re-renders the whole
 * pool — three hundred cards.
 */
function ChampionCard({ onOpen, ...visual }: Readonly<ChampionCardProps>) {
  const { champion } = visual
  const {
    attributes: dndAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: champion.id })

  return (
    <button
      ref={setNodeRef}
      type='button'
      {...dndAttributes}
      {...listeners}
      onClick={() => onOpen?.(champion.id)}
      aria-label={champion.name}
      data-cy={`tierlist-champion-${champion.name}`}
      className={cn(
        'touch-manipulation rounded-md outline-none transition-shadow select-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-30'
      )}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <ChampionCardVisual {...visual} />
    </button>
  )
}

export default memo(ChampionCard)
