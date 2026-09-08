'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { TAG_KEYS } from '../_lib/types'
import type { BoardActions } from '../_hooks/use-board'
import type { CatalogChampion, ChampionTags, TagKey } from '../_lib/types'

interface ChampionSheetProps {
  champion: CatalogChampion | null
  tags: ChampionTags
  actions: BoardActions
  onClose: () => void
}

/**
 * The tags one champion carries, edited in place.
 *
 * Marks are opinions and stay per tier list: the same champion can be an
 * attacker in one and a defender in another, so nothing here touches the roster
 * or the champion catalog.
 */
export default function ChampionSheet({
  champion,
  tags,
  actions,
  onClose,
}: Readonly<ChampionSheetProps>) {
  const { t } = useI18n()
  if (!champion) return null

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
          <DialogTitle>{champion.name}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap gap-2'>
          {TAG_KEYS.map((key: TagKey) => (
            <button
              key={key}
              type='button'
              onClick={() => actions.toggleTag(champion.id, key)}
              data-cy={`tierlist-tag-${key}`}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                tags[key]
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.tierlist.tags[key]}
            </button>
          ))}
        </div>

        {/* Only meaningful once the champion is marked awakened — a signature on
            an unawakened champion is a number nothing reads. */}
        {tags.is_awakened && (
          <label className='flex items-center gap-2 text-xs text-muted-foreground'>
            {t.tierlist.signature}
            <input
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
          </label>
        )}

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
