'use client'

import { useI18n } from '@/app/i18n'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import type { DefensePlanSummary } from '@/app/services/defense'
import type { SeasonFormat } from '@/app/services/season'
import { buildCopyName } from './defense-utils'
import NameDialog from './name-dialog'
import PlanCreateDialog from './plan-create-dialog'
import type { PlanToolbarDialog } from './plan-toolbar'
import type { usePlanCommands } from '../_hooks/use-plan-commands'

interface PlanToolbarDialogsProps {
  dialog: PlanToolbarDialog
  close: (open: boolean) => void
  selected: DefensePlanSummary | null
  previous: DefensePlanSummary | undefined
  allianceId: string
  format: SeasonFormat
  commands: ReturnType<typeof usePlanCommands>
}

export default function PlanToolbarDialogs({
  dialog,
  close,
  selected,
  previous,
  allianceId,
  format,
  commands,
}: Readonly<PlanToolbarDialogsProps>) {
  const { t } = useI18n()
  const p = t.game.defense.plans

  return (
    <>
      <PlanCreateDialog
        open={dialog === 'create'}
        onOpenChange={close}
        allianceId={allianceId}
        format={format}
        onCreate={commands.create}
      />
      <NameDialog
        open={dialog === 'duplicate'}
        onOpenChange={close}
        title={p.duplicate}
        initialName={buildCopyName(p.copyName, selected?.name ?? '')}
        onSubmit={commands.duplicate}
      />
      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={close}
        title={p.rename}
        initialName={selected?.name ?? ''}
        onSubmit={commands.rename}
      />
      <NameDialog
        open={dialog === 'template'}
        onOpenChange={close}
        title={p.saveAsTemplate}
        initialName={selected?.name ?? ''}
        onSubmit={commands.saveAsTemplate}
      />
      <ConfirmationDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={p.deleteTitle}
        description={(selected?.is_active ? p.deleteActiveDesc : p.deleteDesc).replace(
          '{name}',
          selected?.name ?? ''
        )}
        onConfirm={() => {
          void commands.remove()
          close(false)
        }}
        variant='destructive'
      />
      <ConfirmationDialog
        open={dialog === 'activate'}
        onOpenChange={close}
        title={p.activateTitle}
        description={p.activateDesc
          .replace('{name}', selected?.name ?? '')
          .replace('{previous}', previous?.name ?? '')}
        onConfirm={() => {
          void commands.activate()
          close(false)
        }}
      />
    </>
  )
}
