'use client'

import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AUDIT_PURGE_SCOPES, type AuditPurgeScope } from '@/app/services/admin-audit'

interface AuditPurgeDialogProps {
  onPurge: (scope: AuditPurgeScope, beforeDay: string) => Promise<void>
}

export default function AuditPurgeDialog({ onPurge }: Readonly<AuditPurgeDialogProps>) {
  const { t } = useI18n()
  const s = t.admin.audit
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<AuditPurgeScope | ''>('')
  const [day, setDay] = useState('')

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setScope('')
      setDay('')
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={changeOpen}
      title={s.purge.title}
      description={s.purge.description}
      variant='destructive'
      confirmDisabled={!scope || !day}
      onConfirm={() => {
        if (scope) void onPurge(scope, day)
      }}
      dataCy='audit-purge-dialog'
      trigger={
        <Button
          size='sm'
          variant='destructive'
          data-cy='audit-purge'
        >
          <FiTrash2 className='h-4 w-4' />
          {s.purge.button}
        </Button>
      }
    >
      <div className='flex flex-col gap-3'>
        <Select
          value={scope}
          onValueChange={(next) => setScope(next as AuditPurgeScope)}
        >
          <SelectTrigger
            className='w-full'
            aria-label={s.purge.scopeLabel}
            data-cy='audit-purge-scope'
          >
            <SelectValue placeholder={s.purge.scopeLabel} />
          </SelectTrigger>
          <SelectContent>
            {AUDIT_PURGE_SCOPES.map((option) => (
              <SelectItem
                key={option}
                value={option}
                data-cy={`audit-purge-scope-${option}`}
              >
                {s.purge.scopes[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>
    </ConfirmationDialog>
  )
}
