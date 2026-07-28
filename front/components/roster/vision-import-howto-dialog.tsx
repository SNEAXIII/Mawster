'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { CollapsibleSection } from '@/components/collapsible-section'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/app/i18n'

const EXAMPLE_SRC = '/vision/import-example.png'

interface VisionImportHowtoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  dontShow: boolean
  onDontShowChange: (value: boolean) => void
}

// Shown between the "Import IA" button and the file picker. A screenshot of
// the wrong game screen produces a useless import, and nothing else in the UI
// says that only the first two card rows are read.
export default function VisionImportHowtoDialog({
  open,
  onOpenChange,
  onConfirm,
  dontShow,
  onDontShowChange,
}: Readonly<VisionImportHowtoDialogProps>) {
  const { t } = useI18n()
  const howto = t.roster.importExport.vision.howto
  // The example screenshot is dropped in by hand; until then, and if it ever
  // goes missing, the dialog degrades to a labelled placeholder.
  const [imageOk, setImageOk] = useState(true)

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={howto.title}
      description={howto.intro}
      confirmText={howto.confirm}
      onConfirm={onConfirm}
      dataCy='vision-import-howto-dialog'
    >
      <div className='max-h-[60vh] space-y-3 overflow-y-auto text-left text-sm'>
        <ol className='list-decimal space-y-1 pl-5 text-muted-foreground'>
          <li>{howto.step1}</li>
          <li>{howto.step2}</li>
          <li>{howto.step3}</li>
        </ol>

        {imageOk ? (
          <Image
            src={EXAMPLE_SRC}
            alt={howto.exampleAlt}
            width={640}
            height={360}
            className='max-h-64 w-full rounded-md border object-contain'
            onError={() => setImageOk(false)}
          />
        ) : (
          <div className='flex h-32 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs text-muted-foreground'>
            {howto.exampleAlt}
          </div>
        )}

        <div className='rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2'>
          <p className='font-semibold'>{howto.warningTitle}</p>
          <p className='text-muted-foreground'>{howto.warningBody}</p>
        </div>

        <CollapsibleSection title={howto.detailsLabel}>
          <p className='text-muted-foreground'>{howto.detailsBody}</p>
        </CollapsibleSection>

        <div className='flex items-center gap-2 pt-1'>
          <Checkbox
            id='vision-howto-dont-show'
            checked={dontShow}
            onCheckedChange={(checked) => onDontShowChange(checked === true)}
            data-cy='vision-howto-dont-show'
          />
          <Label htmlFor='vision-howto-dont-show'>{howto.dontShowAgain}</Label>
        </div>
      </div>
    </ConfirmationDialog>
  )
}
