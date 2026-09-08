'use client'

import ChampionPortrait from '@/components/champion-portrait'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { readableTextColor } from '../_lib/color'
import { SIGNATURE_PRESETS, TAG_DISPLAY, TAG_ICON, frameRarity } from '../_lib/tags'
import { TAG_KEYS } from '../_lib/types'
import type { BoardActions } from '../_hooks/use-board'
import type { BoardTier, CatalogChampion, ChampionTags, TagKey } from '../_lib/types'

interface ReviewCardProps {
  champion: CatalogChampion
  tags: ChampionTags
  tiers: BoardTier[]
  /** Where this champion sits right now, so a wrong call is visible on the spot. */
  currentTierId: string | undefined
  actions: BoardActions
  onAssign: (tierId: string) => void
}

/** The champion under review: portrait, its tags, and the rows to send it to. */
export default function ReviewCard({
  champion,
  tags,
  tiers,
  currentTierId,
  actions,
  onAssign,
}: Readonly<ReviewCardProps>) {
  const { t } = useI18n()

  return (
    <div className='m-auto flex flex-col items-center gap-4 px-4 py-5'>
      <ChampionPortrait
        imageUrl={champion.image_url}
        name={champion.name}
        rarity={frameRarity(champion)}
        size={168}
        box='frame'
        is_saga_attacker={champion.is_saga_attacker}
        is_saga_defender={champion.is_saga_defender}
        sagaMode='all'
      />
      <div className='text-center'>
        <h2 className='text-lg leading-tight font-black'>{champion.name}</h2>
        <p className='text-xs text-muted-foreground'>
          {champion.champion_class}
          {champion.is_ascendable && ' · ASC'}
        </p>
      </div>

      <div className='flex flex-wrap justify-center gap-1.5'>
        {TAG_KEYS.map((key: TagKey) => (
          <button
            key={key}
            type='button'
            onClick={() => actions.toggleTag(champion.id, key)}
            title={t.tierlist.tags[key]}
            data-cy={`review-tag-${key}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors',
              tags[key]
                ? `${TAG_DISPLAY[key].tone} border-transparent`
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <img
              src={TAG_ICON[key]}
              alt=''
              className='size-4'
            />
            {TAG_DISPLAY[key].code}
          </button>
        ))}
      </div>

      {tags.is_awakened && (
        <div className='flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground'>
          {t.tierlist.signature}
          {SIGNATURE_PRESETS.map((preset) => (
            <button
              key={preset}
              type='button'
              onClick={() => actions.setSignature(champion.id, preset)}
              className={cn(
                'rounded-full border px-2 py-0.5 hover:text-foreground',
                tags.signature === preset && 'border-primary text-foreground'
              )}
            >
              x{preset}
            </button>
          ))}
        </div>
      )}

      <div className='flex max-w-2xl flex-wrap justify-center gap-1.5'>
        {tiers.map((tier) => (
          <button
            key={tier.id}
            type='button'
            onClick={() => onAssign(tier.id)}
            data-cy={`review-send-to-${tier.label}`}
            style={{ backgroundColor: tier.color, color: readableTextColor(tier.color) }}
            className={cn(
              'flex min-w-18 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5',
              'text-base font-black transition-transform hover:scale-103 active:scale-95',
              currentTierId === tier.id &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-background'
            )}
          >
            {tier.label}
            {/* Live count — it ticks up as the run fills the row. */}
            <span className='rounded-full bg-black/20 px-1.5 py-0.5 text-[11px] font-bold tabular-nums'>
              {tier.championIds.length}
            </span>
          </button>
        ))}
      </div>

      <p className='text-[11px] text-muted-foreground'>{t.tierlist.reviewHint}</p>
    </div>
  )
}
