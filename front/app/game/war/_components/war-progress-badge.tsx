'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { useWar } from '@/app/contexts/war-context'

/**
 * Live war counter: fights handled over the whole map and total KOs, with the
 * per-battlegroup breakdown underneath. A fight counts as handled once it is
 * validated or flagged as not fought.
 */
export default function WarProgressBadge() {
  const { t } = useI18n()
  const { progress } = useWar()

  if (!progress) return null

  const warDone = progress.completed >= progress.total

  return (
    <div
      className='flex flex-col leading-tight'
      data-cy='war-progress'
    >
      <div className='flex items-center gap-1'>
        <span className='text-xs font-medium text-muted-foreground'>
          {t.game.war.progressFights}:
        </span>
        <span
          className={cn('text-xs font-bold', warDone && 'text-green-500')}
          data-cy='war-progress-total'
        >
          {progress.completed}/{progress.total}
        </span>
        <span className='text-xs text-muted-foreground'>·</span>
        <span
          className={cn(
            'text-xs font-bold',
            progress.ko_count > 0 ? 'text-red-500' : 'text-green-500'
          )}
          data-cy='war-progress-ko'
        >
          {progress.ko_count} {t.game.war.progressKo}
        </span>
      </div>

      <div className='flex items-center gap-2'>
        {progress.battlegroups.map((bg) => {
          const bgDone = bg.completed >= bg.total
          return (
            <span
              key={bg.battlegroup}
              className={cn('text-[10px]', bgDone ? 'text-green-500' : 'text-muted-foreground')}
              data-cy={`war-progress-bg-${bg.battlegroup}`}
            >
              {t.game.war.progressBg.replace('{bg}', String(bg.battlegroup))} {bg.completed}/
              {bg.total} <span className='text-muted-foreground'>·</span>{' '}
              <span className={cn(bg.ko_count > 0 && 'text-red-500')}>{bg.ko_count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
