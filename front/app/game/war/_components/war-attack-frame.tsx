'use client'

import type { ReactNode } from 'react'
import { OctagonX, Swords } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'

/** Colours the map's own frame and sits the status on its edge, so it costs no extra row. */
export default function WarAttackFrame({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useI18n()
  const { currentWar, isWarClosed, canPlaceWar, isBgReady, handleToggleBgReady } = useWar()

  const shown = Boolean(currentWar) && !isWarClosed
  const Icon = isBgReady ? Swords : OctagonX
  const badgeClass = cn(
    'absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide shadow-md',
    isBgReady ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'
  )
  const badgeContent = (
    <>
      <Icon className='size-3.5' />
      {isBgReady ? t.game.war.attackOpenTitle : t.game.war.attackClosedTitle}
    </>
  )

  return (
    <div
      className={cn(
        'relative flex-1 min-w-0 rounded-xl border bg-card shadow-sm',
        shown &&
          (isBgReady
            ? 'border-2 border-green-600 shadow-lg shadow-green-600/30'
            : 'border-2 border-destructive shadow-lg shadow-destructive/30')
      )}
      data-cy='war-attack-frame'
      data-ready={shown ? isBgReady : undefined}
    >
      {shown &&
        (canPlaceWar ? (
          <button
            type='button'
            className={cn(badgeClass, 'cursor-pointer hover:brightness-110')}
            onClick={handleToggleBgReady}
            title={isBgReady ? t.game.war.closeAttacks : t.game.war.openAttacks}
            aria-pressed={isBgReady}
            data-cy='war-attack-toggle'
          >
            {badgeContent}
          </button>
        ) : (
          <span
            className={badgeClass}
            title={isBgReady ? t.game.war.attackOpenHint : t.game.war.attackClosedHint}
            data-cy='war-attack-status'
          >
            {badgeContent}
          </span>
        ))}
      <div className='overflow-x-auto rounded-xl'>{children}</div>
    </div>
  )
}
