'use client'

import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AuditPurgeScope } from '@/app/services/admin-audit'

interface AuditPurgeDialogProps {
  scope: AuditPurgeScope
  onPurge: (scope: AuditPurgeScope, beforeDay: string) => Promise<void>
}

export default function AuditPurgeDialog({ scope, onPurge }: Readonly<AuditPurgeDialogProps>) {
  const { t } = useI18n()
  const s = t.admin.audit
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const { label, description } = s.purge[scope]

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) setDay('')
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={changeOpen}
      title={label}
      description={description}
      variant='destructive'
      confirmDisabled={!day}
      onConfirm={() => void onPurge(scope, day)}
      dataCy='audit-purge-dialog'
      trigger={
        <Button
          size='sm'
          variant='destructive'
          data-cy={`audit-purge-${scope}`}
        >
          <FiTrash2 className='h-4 w-4' />
          {label}
        </Button>
      }
    >
      <label className='text-muted-foreground flex items-center gap-2 text-sm'>
        {s.purgeBefore}
        <Input
          type='date'
          className='w-40'
          value={day}
          onChange={(e) => setDay(e.target.value)}
          data-cy='audit-purge-before'
        />
      </label>
    </ConfirmationDialog>
  )
}
