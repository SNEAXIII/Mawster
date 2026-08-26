'use client'

import { useI18n } from '@/app/i18n'
import { formatDateLong } from '@/app/lib/utils'
import type { DeletedGameAccount } from '@/app/services/game'
import { Button } from '@/components/ui/button'
import { Loader, RotateCcw, Trash2 } from 'lucide-react'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole days left before the restore deadline — 1 on the very last day. */
export function daysLeftBefore(deadline: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now.getTime()) / MS_PER_DAY))
}

type DeletedAccountsListProps = Readonly<{
  accounts: DeletedGameAccount[]
  restoreWindowDays: number
  restoringId: string | null
  onRestore: (account: DeletedGameAccount) => void
}>

export default function DeletedAccountsList({
  accounts,
  restoreWindowDays,
  restoringId,
  onRestore,
}: DeletedAccountsListProps) {
  const { locale, t } = useI18n()

  if (accounts.length === 0) return null

  return (
    <div
      className='space-y-2 rounded-lg border border-dashed border-muted-foreground/30 p-3'
      data-cy='deleted-accounts-section'
    >
      <div className='flex items-center gap-2'>
        <Trash2 className='h-4 w-4 text-muted-foreground' />
        <p className='text-sm font-medium text-foreground'>{t.game.accounts.deletedTitle}</p>
      </div>
      <p className='text-xs text-muted-foreground'>
        {t.game.accounts.deletedHint.replace('{days}', String(restoreWindowDays))}
      </p>
      {accounts.map((account) => {
        const daysLeft = daysLeftBefore(account.restorable_until)
        return (
          <div
            key={account.id}
            className='flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40'
            data-cy={`deleted-account-row-${account.game_pseudo}`}
          >
            <div className='min-w-0'>
              <p className='text-sm font-medium text-muted-foreground line-through'>
                {account.game_pseudo}
              </p>
              <p className='text-xs text-muted-foreground'>
                {t.game.accounts.deletedOn.replace(
                  '{date}',
                  formatDateLong(account.deleted_at, locale)
                )}
                {' · '}
                <span data-cy={`deleted-account-days-left-${account.game_pseudo}`}>
                  {daysLeft <= 1
                    ? t.game.accounts.lastDayLeft
                    : t.game.accounts.daysLeft.replace('{count}', String(daysLeft))}
                </span>
              </p>
            </div>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-green-600 hover:bg-green-500/10 shrink-0'
              onClick={() => onRestore(account)}
              disabled={restoringId !== null}
              data-cy={`account-restore-btn-${account.game_pseudo}`}
            >
              {restoringId === account.id ? (
                <Loader className='h-4 w-4 animate-spin' />
              ) : (
                <RotateCcw className='h-4 w-4' />
              )}
              <span className='ml-1'>{t.game.accounts.restore}</span>
            </Button>
          </div>
        )
      })}
    </div>
  )
}
