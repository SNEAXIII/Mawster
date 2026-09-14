'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useI18n } from '@/app/i18n'
import type { AllianceActions } from '../_viewmodels/use-alliance-actions'

interface AllianceLeaveVisitButtonProps {
  allianceId: string
  actions: AllianceActions
}

/**
 * Lets a visitor end their own visit of an alliance. Members leave from their
 * own member row; a visitor has no row of their own to act on, so the action
 * lives in the alliance header.
 */
export default function AllianceLeaveVisitButton({
  allianceId,
  actions,
}: Readonly<AllianceLeaveVisitButtonProps>) {
  const { t } = useI18n()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  async function handleConfirm() {
    setIsLeaving(true)
    if (await actions.leaveVisit(allianceId)) setIsDialogOpen(false)
    setIsLeaving(false)
  }

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        className='text-destructive hover:text-destructive hover:bg-destructive/10'
        disabled={isLeaving}
        onClick={() => setIsDialogOpen(true)}
        data-cy='leave-visit-button'
      >
        <LogOut className='size-3 mr-1' />
        {t.game.alliances.leaveVisit}
      </Button>

      <ConfirmationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={t.game.alliances.leaveVisit}
        description={t.game.alliances.leaveVisitConfirm}
        onConfirm={handleConfirm}
        confirmText={t.game.alliances.leaveVisit}
        variant='destructive'
      />
    </>
  )
}
