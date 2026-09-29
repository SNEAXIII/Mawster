'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
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
import NameDialog from './name-dialog'

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
  const [source, setSource] = useState(SCRATCH)
  const [templates, setTemplates] = useState<DefenseTemplateSummary[]>([])

  useEffect(() => {
    if (!open) return
    setSource(SCRATCH)
    listTemplates(allianceId, format)
      .then((list) => setTemplates(list.templates))
      .catch(() => setTemplates([]))
  }, [open, allianceId, format])

  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title={p.createTitle}
      initialName=''
      submitLabel={p.create}
      onSubmit={(name) =>
        onCreate({ name, format, template_id: source === SCRATCH ? undefined : source })
      }
    >
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
    </NameDialog>
  )
}
