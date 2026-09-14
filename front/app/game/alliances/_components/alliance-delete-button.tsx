'use client'

import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useAllianceRole } from '@/hooks/use-alliance-role'
import type { Alliance } from '@/app/services/game'
import type { AllianceActions } from '../_viewmodels/use-alliance-actions'

interface AllianceDeleteButtonProps {
  alliance: Alliance
  actions: AllianceActions
}

/**
 * Disband button, leader only. It stays visible but disabled while anyone else
 * is still in the alliance, so the leader can see the rule instead of hunting
 * for a button that isn't there — the backend enforces the same condition.
 */
export default function AllianceDeleteButton({
  alliance,
  actions,
}: Readonly<AllianceDeleteButtonProps>) {
  const { t } = useI18n()
  const { isOwner } = useAllianceRole()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!isOwner(alliance)) return null

  const isAlone = alliance.member_count <= 1

  async function handleConfirm() {
    setOpen(false)
    setDeleting(true)
    await actions.disband(alliance)
    setDeleting(false)
  }

  return (
    <>
      <Button
        size='sm'
        variant='ghost'
        className='text-destructive hover:text-destructive/80 hover:bg-destructive/10'
        disabled={!isAlone || deleting}
        title={isAlone ? undefined : t.game.alliances.deleteOnlyWhenAlone}
        data-cy='alliance-delete-toggle'
        onClick={() => setOpen(true)}
      >
        <FiTrash2 className='size-3 mr-1' />
        {t.game.alliances.deleteAlliance}
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={t.game.alliances.deleteConfirmTitle}
        description={t.game.alliances.deleteConfirmDesc.replaceAll('{name}', alliance.name)}
        confirmText={t.game.alliances.deleteAlliance}
        variant='destructive'
        requireConfirmText={alliance.name}
        onConfirm={() => void handleConfirm()}
        dataCy='alliance-delete-dialog'
      />
    </>
  )
}
