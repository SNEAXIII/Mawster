'use client'

import { useEffect, useState } from 'react'
import { FiVolumeX, FiAlertTriangle, FiTrash2 } from 'react-icons/fi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import type { ModerationViewModel } from '../_viewmodels/use-moderation-viewmodel'
import UserModerationDialog, { type ModerationKind } from './user-moderation-dialog'

type RevisionHistoryDialogProps = Readonly<{
  noteId: string | null
  onClose: () => void
  vm: ModerationViewModel
}>

type Target = { userId: string; userLogin: string }

export default function RevisionHistoryDialog({ noteId, onClose, vm }: RevisionHistoryDialogProps) {
  const { t } = useI18n()
  const m = t.moderation
  const { revisions, revisionsLoading: loading, loadRevisions } = vm
  const [dialogKind, setDialogKind] = useState<ModerationKind | null>(null)
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null)

  useEffect(() => {
    if (noteId) void loadRevisions(noteId)
  }, [noteId, loadRevisions])

  const openDialog = (kind: ModerationKind, target: Target) => {
    setDialogTarget(target)
    setDialogKind(kind)
  }

  const onSubmit = async (reason: string, expiresAt: string | null) => {
    if (!dialogTarget || !dialogKind) return
    const kind = dialogKind
    setDialogKind(null)
    await vm.sanction(kind, dialogTarget.userId, reason, expiresAt)
  }

  return (
    <Dialog
      open={!!noteId}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent data-cy='moderation-revisions-dialog'>
        <DialogHeader>
          <DialogTitle>{m.revisionsTitle}</DialogTitle>
        </DialogHeader>
        {loading && <p className='text-sm text-muted-foreground'>{t.common.loading}</p>}
        {!loading && revisions.length === 0 && (
          <p className='text-sm text-muted-foreground'>{m.noRevisions}</p>
        )}
        {!loading && revisions.length > 0 && (
          <ul className='flex flex-col gap-3 max-h-96 overflow-y-auto'>
            {revisions.map((rev) => {
              if (rev.is_deletion) {
                return (
                  <li
                    key={rev.id}
                    className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                    data-cy='moderation-revision-deletion'
                  >
                    <FiTrash2 className='size-4 shrink-0' />
                    <span>
                      {m.noteDeletedBy} {rev.edited_by_pseudo ?? '—'} ·{' '}
                      {new Date(rev.edited_at).toLocaleString()}
                    </span>
                  </li>
                )
              }
              const author: Target | null = rev.edited_by_user_id
                ? { userId: rev.edited_by_user_id, userLogin: rev.edited_by_pseudo ?? '—' }
                : null
              return (
                <li
                  key={rev.id}
                  className='rounded-md border border-border bg-card p-3 flex flex-col gap-2'
                  data-cy='moderation-revision-row'
                >
                  <p className='text-sm whitespace-pre-wrap break-words'>{rev.content}</p>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-xs text-muted-foreground'>
                      {rev.edited_by_pseudo ?? '—'} · {new Date(rev.edited_at).toLocaleString()}
                    </p>
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={!author}
                        data-cy='revision-mute'
                        onClick={() => author && openDialog('mute', author)}
                      >
                        <FiVolumeX className='mr-1 size-4' />
                        {m.mute}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={!author}
                        data-cy='revision-warn'
                        onClick={() => author && openDialog('warn', author)}
                      >
                        <FiAlertTriangle className='mr-1 size-4' />
                        {m.warn}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <UserModerationDialog
          kind={dialogKind}
          userLogin={dialogTarget?.userLogin ?? null}
          onClose={() => setDialogKind(null)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}
