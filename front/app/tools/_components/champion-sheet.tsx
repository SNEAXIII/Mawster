'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ChampionPortrait from '@/components/champion-portrait'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { POOL_ID } from '../_hooks/use-board'
import { readableTextColor } from '../_lib/color'
import { SIGNATURE_PRESETS, TAG_DISPLAY, TAG_ICON, frameRarity } from '../_lib/tags'
import { TAG_KEYS } from '../_lib/types'
import type { BoardActions } from '../_hooks/use-board'
import type { StarMode } from '../_hooks/use-prefs'
import type { BoardState, CatalogChampion, ChampionTags, TagKey } from '../_lib/types'

interface ChampionSheetProps {
  champion: CatalogChampion | null
  board: BoardState
  tags: ChampionTags
  starMode: StarMode
  actions: BoardActions
  onClose: () => void
}

/**
 * Tap a champion to open this: it sets the tags, the signature level, and sends
 * the champion to a row — the touch-friendly counterpart of dragging.
 *
 * Tags are opinions and stay inside this tier list: the same champion can be an
 * attacker in one and a defender in another, and nothing here touches the
 * roster or the champion catalog.
 */
export default function ChampionSheet({
  champion,
  board,
  tags,
  starMode,
  actions,
  onClose,
}: Readonly<ChampionSheetProps>) {
  const { t } = useI18n()
  if (!champion) return null

  const currentTier = board.tiers.find((tier) => tier.championIds.includes(champion.id))

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        className='sm:max-w-md'
        data-cy='tierlist-champion-sheet'
      >
        <DialogHeader>
          <DialogTitle className='uppercase'>{champion.name}</DialogTitle>
        </DialogHeader>

        <div className='flex items-center gap-3'>
          <ChampionPortrait
            imageUrl={champion.image_url}
            name={champion.name}
            rarity={frameRarity(champion, starMode)}
            size={88}
            box='frame'
            is_saga_attacker={champion.is_saga_attacker}
            is_saga_defender={champion.is_saga_defender}
            sagaMode='all'
          />
          <div className='flex flex-col gap-0.5 text-xs text-muted-foreground'>
            <span className='text-sm font-semibold text-foreground'>{champion.name}</span>
            <span>{champion.champion_class}</span>
            {champion.alias && <span className='italic'>{champion.alias}</span>}
            {champion.is_ascendable && <span>{t.tierlist.ascendableOnly}</span>}
          </div>
        </div>

        <section className='flex flex-col gap-2'>
          <h3 className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
            {t.tierlist.tagsTitle}
          </h3>
          <div className='flex flex-wrap gap-1.5'>
            {TAG_KEYS.map((key: TagKey) => (
              <button
                key={key}
                type='button'
                onClick={() => actions.toggleTag(champion.id, key)}
                title={t.tierlist.tags[key]}
                data-cy={`tierlist-tag-${key}`}
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

          {/* Only once the champion is marked awakened — a signature on an
              unawakened champion is a number nothing reads. */}
          {tags.is_awakened && (
            <div className='flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2'>
              <label
                htmlFor='tierlist-signature'
                className='text-xs font-semibold text-muted-foreground'
              >
                {t.tierlist.signature}
              </label>
              <input
                id='tierlist-signature'
                type='number'
                min={0}
                max={200}
                value={tags.signature}
                onChange={(event) =>
                  actions.setSignature(
                    champion.id,
                    Math.min(200, Math.max(0, Number(event.target.value) || 0))
                  )
                }
                data-cy='tierlist-signature'
                className='w-20 rounded-md border bg-background px-2 py-1 text-sm'
              />
              {SIGNATURE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type='button'
                  onClick={() => actions.setSignature(champion.id, preset)}
                  className='rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                >
                  x{preset}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className='flex flex-col gap-2'>
          <h3 className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
            {t.tierlist.sendTo}
          </h3>
          <div className='flex flex-wrap gap-1.5'>
            {board.tiers.map((tier) => (
              <button
                key={tier.id}
                type='button'
                onClick={() => actions.moveChampion(champion.id, tier.id)}
                disabled={tier.id === currentTier?.id}
                data-cy={`tierlist-send-to-${tier.label}`}
                style={{ backgroundColor: tier.color, color: readableTextColor(tier.color) }}
                className='rounded-md px-3 py-1 text-sm font-black disabled:opacity-40'
              >
                {tier.label}
              </button>
            ))}
            <button
              type='button'
              onClick={() => actions.moveChampion(champion.id, POOL_ID)}
              disabled={!currentTier}
              data-cy='tierlist-back-to-pool'
              className='rounded-md border px-3 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40'
            >
              {t.tierlist.backToPool}
            </button>
          </div>
        </section>

        <div className='flex justify-between'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => actions.clearTags(champion.id)}
            data-cy='tierlist-clear-tags'
          >
            {t.tierlist.clearTags}
          </Button>
          <Button
            size='sm'
            onClick={onClose}
          >
            {t.tierlist.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
