'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import { rankedIds } from '../_lib/board'
import type { BoardState } from '../_lib/types'

interface ImportLocalBoardDialogProps {
  /** The board this browser kept while signed out, or null when there is none. */
  storedBoard: BoardState | null
  onImport: () => void
  onDiscard: () => void
}

/**
 * Offers to bring the browser's board into the account, once, after signing in.
 *
 * Asked rather than done: importing on its own would overwrite whatever list is
 * open, and the board someone was trying out signed out is not necessarily the
 * one they want to keep.
 */
export default function ImportLocalBoardDialog({
  storedBoard,
  onImport,
  onDiscard,
}: Readonly<ImportLocalBoardDialogProps>) {
  const { t } = useI18n()
  if (!storedBoard) return null

  const count = rankedIds(storedBoard).size

  return (
    <Dialog open>
      <DialogContent
        className='sm:max-w-md'
        data-cy='tierlist-import-local-dialog'
      >
        <DialogHeader>
          <DialogTitle>{t.tierlist.importLocalTitle}</DialogTitle>
        </DialogHeader>
        <p className='text-sm text-muted-foreground'>
          {t.tierlist.importLocalBody.replace('{count}', String(count))}
        </p>
        <div className='flex justify-end gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onDiscard}
            data-cy='tierlist-import-local-discard'
          >
            {t.tierlist.importLocalDiscard}
          </Button>
          <Button
            size='sm'
            onClick={onImport}
            data-cy='tierlist-import-local-confirm'
          >
            {t.tierlist.importLocalConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
