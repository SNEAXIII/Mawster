'use client'

import { useState } from 'react'
import { FiCopy, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { buildCopyName } from './defense-utils'
import NameDialog from './name-dialog'
import QuotaCreateButton from './quota-create-button'
import NamedSelect from './named-select'
import type { useTemplates } from '../_hooks/use-templates'

type TemplateToolbarDialog = 'create' | 'duplicate' | 'rename' | 'delete' | null

export default function TemplateToolbar({
  state,
}: Readonly<{ state: ReturnType<typeof useTemplates> }>) {
  const { t } = useI18n()
  const m = t.game.defense.templates
  const [dialog, setDialog] = useState<TemplateToolbarDialog>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const name = state.selected?.name ?? ''
  const full = state.quota.used >= state.quota.limit

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <NamedSelect
        items={state.templates.map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          display: `${tpl.name} · ${tpl.filled_nodes}`,
        }))}
        value={state.selectedId ?? ''}
        onChange={state.setSelectedId}
        placeholder={m.none}
        dataCy='template'
      />
      <QuotaCreateButton
        label={m.create}
        quota={state.quota}
        reachedText={m.quotaReached}
        onClick={() => setDialog('create')}
        dataCy='template'
      />
      {state.selected && (
        <>
          <Button
            size='sm'
            variant='outline'
            disabled={full}
            onClick={() => setDialog('duplicate')}
            data-cy='template-duplicate-btn'
          >
            <FiCopy className='mr-1' />
            {m.duplicate}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setDialog('rename')}
            data-cy='template-rename-btn'
          >
            <FiEdit2 className='mr-1' />
            {m.rename}
          </Button>
          <Button
            size='sm'
            variant='destructive'
            onClick={() => setDialog('delete')}
            data-cy='template-delete-btn'
          >
            <FiTrash2 className='mr-1' />
            {m.delete}
          </Button>
        </>
      )}
      <NameDialog
        open={dialog === 'create'}
        onOpenChange={close}
        title={m.createTitle}
        initialName=''
        onSubmit={state.create}
      />
      <NameDialog
        open={dialog === 'duplicate'}
        onOpenChange={close}
        title={m.duplicate}
        initialName={buildCopyName(t.game.defense.plans.copyName, name)}
        onSubmit={state.duplicate}
      />
      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={close}
        title={m.rename}
        initialName={name}
        onSubmit={state.rename}
      />
      <ConfirmationDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={m.deleteTitle}
        description={m.deleteDesc.replace('{name}', name)}
        onConfirm={() => {
          state.remove()
          setDialog(null)
        }}
        variant='destructive'
      />
    </div>
  )
}
