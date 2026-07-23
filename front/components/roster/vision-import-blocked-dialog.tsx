'use client'

import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useI18n } from '@/app/i18n'

interface VisionImportBlockedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResume: () => void
  onDiscard: () => void
}

// Shown instead of the file picker when "Import IA" is clicked while an
// import is already actionable — avoids the 409 the user would otherwise hit
// after already choosing screenshots. "Resume" lives on the Cancel slot
// (the safe default) so Esc/overlay-dismiss stays a true no-op, while
// "discard and start over" is the one deliberate, destructive action.
export default function VisionImportBlockedDialog({
  open,
  onOpenChange,
  onResume,
  onDiscard,
}: Readonly<VisionImportBlockedDialogProps>) {
  const { t } = useI18n()
  const vision = t.roster.importExport.vision

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={vision.blockedTitle}
      description={vision.blockedDescription}
      cancelText={vision.blockedResume}
      onCancelClick={onResume}
      confirmText={vision.blockedDiscard}
      onConfirm={onDiscard}
      variant='destructive'
      dataCy='vision-import-blocked-dialog'
    />
  )
}
