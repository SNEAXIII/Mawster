'use client'

import { useState } from 'react'
import { FiEdit2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useAllianceRole } from '@/hooks/use-alliance-role'
import type { Alliance } from '@/app/services/game'
import {
  type AllianceActions,
  cleanAllianceName,
  cleanAllianceTag,
} from '../_viewmodels/use-alliance-actions'

interface AllianceRenameButtonProps {
  alliance: Alliance
  actions: AllianceActions
}

export default function AllianceRenameButton({
  alliance,
  actions,
}: Readonly<AllianceRenameButtonProps>) {
  const { t } = useI18n()
  const { isOwner } = useAllianceRole()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(alliance.name)
  const [tag, setTag] = useState(alliance.tag)

  if (!isOwner(alliance)) return null

  function handleOpen() {
    setName(alliance.name)
    setTag(alliance.tag)
    setOpen(true)
  }

  return (
    <>
      <Button
        size='sm'
        variant='ghost'
        data-cy='alliance-rename-toggle'
        onClick={handleOpen}
      >
        <FiEdit2 className='size-3 mr-1' />
        {t.game.alliances.rename}
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={t.game.alliances.rename}
        description={t.game.alliances.renameDesc}
        confirmText={t.common.save}
        onConfirm={() => void actions.rename(alliance.id, name.trim(), tag.trim())}
        confirmDisabled={name.trim() === alliance.name && tag.trim() === alliance.tag}
        dataCy='alliance-rename-dialog'
      >
        <div className='flex flex-col gap-3 pt-2 text-left'>
          <Label htmlFor='rename-name'>{t.game.alliances.name}</Label>
          <Input
            id='rename-name'
            data-cy='alliance-rename-name-input'
            value={name}
            onChange={(e) => setName(cleanAllianceName(e.target.value))}
          />
          <Label htmlFor='rename-tag'>{t.game.alliances.tag}</Label>
          <Input
            id='rename-tag'
            data-cy='alliance-rename-tag-input'
            value={tag}
            onChange={(e) => setTag(cleanAllianceTag(e.target.value))}
          />
        </div>
      </ConfirmationDialog>
    </>
  )
}
