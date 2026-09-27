'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialName: string
  onSubmit: (name: string) => void
}

const NAME_MAX_LENGTH = 50

export default function NameDialog({
  open,
  onOpenChange,
  title,
  initialName,
  onSubmit,
}: Readonly<NameDialogProps>) {
  const { t } = useI18n()
  const [name, setName] = useState(initialName)
  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])
  const trimmed = name.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!trimmed) return
            onSubmit(trimmed)
            onOpenChange(false)
          }}
        >
          <Input
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            aria-label={t.game.defense.plans.nameLabel}
            data-cy='name-dialog-input'
            autoFocus
          />
          <Button
            type='submit'
            disabled={!trimmed}
            data-cy='name-dialog-submit'
          >
            {t.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
