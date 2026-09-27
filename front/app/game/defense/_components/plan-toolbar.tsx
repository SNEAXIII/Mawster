'use client'

import { useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FiCopy, FiEdit2, FiSave, FiTrash2, FiCheckCircle } from 'react-icons/fi'
import type { DefensePlanSummary, Quota } from '@/app/services/defense'
import type { SeasonFormat } from '@/app/services/season'
import PlanStateBadge from './plan-state-badge'
import QuotaCreateButton from './quota-create-button'
import PlanToolbarDialogs from './plan-toolbar-dialogs'
import type { usePlanCommands } from '../_hooks/use-plan-commands'

type Dialog = 'create' | 'duplicate' | 'rename' | 'template' | 'delete' | 'activate' | null

interface PlanToolbarProps {
  allianceId: string
  format: SeasonFormat
  plans: DefensePlanSummary[]
  quota: Quota
  selected: DefensePlanSummary | null
  onSelect: (planId: string) => void
  commands: ReturnType<typeof usePlanCommands>
}

export default function PlanToolbar(props: Readonly<PlanToolbarProps>) {
  const { allianceId, format, plans, quota, selected, onSelect, commands } = props
  const { t } = useI18n()
  const p = t.game.defense.plans
  const [dialog, setDialog] = useState<Dialog>(null)
  const full = quota.used >= quota.limit
  const previous = plans.find((plan) => plan.is_active)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select
        value={selected?.id ?? ''}
        onValueChange={onSelect}
      >
        <SelectTrigger
          className='w-56'
          data-cy='plan-select'
        >
          <SelectValue placeholder={p.none} />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem
              key={plan.id}
              value={plan.id}
              data-cy={`plan-option-${plan.name}`}
            >
              {plan.is_active ? `★ ${plan.name}` : plan.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && <PlanStateBadge plan={selected} />}
      <QuotaCreateButton
        label={p.create}
        quota={quota}
        reachedText={p.quotaReached}
        onClick={() => setDialog('create')}
        dataCy='plan'
      />
      {selected && (
        <>
          <Button
            size='sm'
            variant='outline'
            disabled={full}
            onClick={() => setDialog('duplicate')}
            data-cy='plan-duplicate-btn'
          >
            <FiCopy className='mr-1' />
            {p.duplicate}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setDialog('template')}
            data-cy='plan-save-template-btn'
          >
            <FiSave className='mr-1' />
            {p.saveAsTemplate}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setDialog('rename')}
            data-cy='plan-rename-btn'
          >
            <FiEdit2 className='mr-1' />
            {p.rename}
          </Button>
          {!selected.is_active && (
            <Button
              size='sm'
              disabled={selected.state !== 'validated'}
              onClick={() => (previous ? setDialog('activate') : commands.activate())}
              data-cy='plan-activate-btn'
            >
              <FiCheckCircle className='mr-1' />
              {p.activate}
            </Button>
          )}
          <Button
            size='sm'
            variant='destructive'
            onClick={() => setDialog('delete')}
            data-cy='plan-delete-btn'
          >
            <FiTrash2 className='mr-1' />
            {p.delete}
          </Button>
        </>
      )}
      <PlanToolbarDialogs
        dialog={dialog}
        close={close}
        selected={selected}
        previous={previous}
        allianceId={allianceId}
        format={format}
        commands={commands}
      />
    </div>
  )
}
