'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreatePlanBody } from '@/app/services/defense'
import { listTemplates, type DefenseTemplateSummary } from '@/app/services/defense-templates'
import type { SeasonFormat } from '@/app/services/season'

const SCRATCH = '__scratch__'

interface PlanCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allianceId: string
  format: SeasonFormat
  onCreate: (body: CreatePlanBody) => void
}

export default function PlanCreateDialog({
  open,
  onOpenChange,
  allianceId,
  format,
  onCreate,
}: Readonly<PlanCreateDialogProps>) {
  const { t } = useI18n()
  const p = t.game.defense.plans
  const [name, setName] = useState('')
  const [source, setSource] = useState(SCRATCH)
  const [templates, setTemplates] = useState<DefenseTemplateSummary[]>([])

  useEffect(() => {
    if (!open) return
    setName('')
    setSource(SCRATCH)
    listTemplates(allianceId, format)
      .then((list) => setTemplates(list.templates))
      .catch(() => setTemplates([]))
  }, [open, allianceId, format])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate({ name: trimmed, format, template_id: source === SCRATCH ? undefined : source })
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.createTitle}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <Input
            value={name}
            maxLength={50}
            placeholder={p.nameLabel}
            onChange={(e) => setName(e.target.value)}
            data-cy='name-dialog-input'
          />
          <label className='text-sm font-medium'>{p.fromTemplate}</label>
          <Select
            value={source}
            onValueChange={setSource}
          >
            <SelectTrigger data-cy='plan-create-template-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCRATCH}>{p.fromScratch}</SelectItem>
              {templates.map((tpl) => (
                <SelectItem
                  key={tpl.id}
                  value={tpl.id}
                  data-cy={`plan-create-template-${tpl.name}`}
                >
                  {tpl.name} · {tpl.filled_nodes}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={submit}
            disabled={!name.trim()}
            data-cy='name-dialog-submit'
          >
            {p.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
