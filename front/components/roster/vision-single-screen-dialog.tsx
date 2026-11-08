'use client'

import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/app/i18n'
import type { useVisionSingleScreenWarning } from '@/components/use-vision-single-screen-warning'

interface VisionSingleScreenDialogProps {
  warning: ReturnType<typeof useVisionSingleScreenWarning>
}

export default function VisionSingleScreenDialog({
  warning,
}: Readonly<VisionSingleScreenDialogProps>) {
  const { t } = useI18n()
  const copy = t.roster.importExport.vision.singleScreen

  return (
    <ConfirmationDialog
      open={warning.open}
      onOpenChange={warning.setOpen}
      title={copy.title}
      description={copy.body}
      confirmText={copy.confirm}
      cancelText={copy.addMore}
      onConfirm={warning.confirm}
      onCancelClick={warning.addMore}
      dataCy='vision-single-screen-dialog'
    >
      <div className='flex items-center gap-2 pt-2'>
        <Checkbox
          id='vision-single-screen-dismiss'
          checked={warning.dontShowAgain}
          onCheckedChange={(checked) => warning.setDontShowAgain(checked === true)}
          data-cy='vision-single-screen-dismiss'
        />
        <Label
          htmlFor='vision-single-screen-dismiss'
          className='cursor-pointer select-none'
        >
          {copy.dontShowAgain}
        </Label>
      </div>
    </ConfirmationDialog>
  )
}
