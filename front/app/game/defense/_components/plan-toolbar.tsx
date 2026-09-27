'use client'

import { useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { FiCopy, FiEdit2, FiSave, FiTrash2, FiCheckCircle } from 'react-icons/fi'
import type { DefensePlanSummary, Quota } from '@/app/services/defense'
import type { SeasonFormat } from '@/app/services/season'
import PlanStateBadge from './plan-state-badge'
import QuotaCreateButton from './quota-create-button'
import PlanToolbarDialogs from './plan-toolbar-dialogs'
import NamedSelect from './named-select'
import type { usePlanCommands } from '../_hooks/use-plan-commands'

export type PlanToolbarDialog =
  'create' | 'duplicate' | 'rename' | 'template' | 'delete' | 'activate' | null

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
  const [dialog, setDialog] = useState<PlanToolbarDialog>(null)
  const full = quota.used >= quota.limit
  const previous = plans.find((plan) => plan.is_active)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <NamedSelect
        items={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          display: plan.is_active ? `★ ${plan.name}` : plan.name,
        }))}
        value={selected?.id ?? ''}
        onChange={onSelect}
        placeholder={p.none}
        dataCy='plan'
      />
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
