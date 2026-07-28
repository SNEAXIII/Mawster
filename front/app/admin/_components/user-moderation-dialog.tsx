'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/app/i18n'

export type ModerationKind = 'mute' | 'warn'

type UserModerationDialogProps = Readonly<{
  kind: ModerationKind | null
  userLogin: string | null
  onClose: () => void
  onSubmit: (reason: string, expiresAt: string | null) => void
}>

export default function UserModerationDialog({
  kind,
  userLogin,
  onClose,
  onSubmit,
}: UserModerationDialogProps) {
  const { t } = useI18n()
  const m = t.moderation
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (kind) {
      setReason('')
      setExpiresAt('')
    }
  }, [kind])

  const isMute = kind === 'mute'
  const title = isMute ? m.muteTitle : m.warnTitle
  const description = isMute ? m.muteDescription : m.warnDescription
  const confirmCy = isMute ? 'moderation-mute-confirm' : 'moderation-warn-confirm'
  const canSubmit = reason.trim().length > 0

  return (
    <Dialog
      open={!!kind}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent data-cy='user-moderation-dialog'>
        <DialogHeader>
          <DialogTitle>
            {title}
            {userLogin ? ` — ${userLogin}` : ''}
          </DialogTitle>
        </DialogHeader>
        <p className='text-sm text-muted-foreground'>{description}</p>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='moderation-reason'>{m.reasonLabel}</Label>
          <textarea
            id='moderation-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={m.reasonPlaceholder}
            maxLength={500}
            data-cy='moderation-reason-input'
            className='min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          />
          <span className='text-xs text-muted-foreground self-end'>{reason.length} / 500</span>
        </div>
        {isMute && (
          <div className='flex flex-col gap-2'>
            <Label htmlFor='moderation-expiry'>{m.expiryLabel}</Label>
            <Input
              id='moderation-expiry'
              type='datetime-local'
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              data-cy='moderation-expiry-input'
            />
          </div>
        )}
        <DialogFooter>
          <Button
            variant='outline'
            onClick={onClose}
            data-cy='user-moderation-cancel'
          >
            {t.common.cancel}
          </Button>
          <Button
            disabled={!canSubmit}
            data-cy={confirmCy}
            onClick={() =>
              onSubmit(
                reason.trim(),
                isMute && expiresAt ? new Date(expiresAt).toISOString() : null
              )
            }
          >
            {t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
