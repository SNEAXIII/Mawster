'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { TAG_DISPLAY, TAG_ICON } from '../_lib/tags'
import { TAG_KEYS, type TagKey } from '../_lib/types'
interface TagChipsProps {
  /** Which tags are drawn as set. */
  isActive: (key: TagKey) => boolean
  onToggle: (key: TagKey) => void
  /** Each chip carries `${cyPrefix}${key}` — the callers name them differently. */
  cyPrefix: string
  /** Classes for the row itself; the review card centres it. */
  className?: string
}

/**
 * The five tags as chips one can switch on and off.
 *
 * One component for the three places that draw them — the champion sheet, the
 * review card and the filter bar. They only ever differed by what "set" means
 * and by two pixels of padding, and three copies is how a chip ends up reading
 * ATK in one of them and something else in the next.
 *
 * Read-only marks under a card are [TagBadges]; these are the switches.
 */
export default function TagChips({
  isActive,
  onToggle,
  cyPrefix,
  className,
}: Readonly<TagChipsProps>) {
  const { t } = useI18n()

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {TAG_KEYS.map((key: TagKey) => {
        const active = isActive(key)
        return (
          <button
            key={key}
            type='button'
            onClick={() => onToggle(key)}
            title={t.tierlist.tags[key]}
            data-cy={`${cyPrefix}${key}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors',
              active
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
        )
      })}
    </div>
  )
}
