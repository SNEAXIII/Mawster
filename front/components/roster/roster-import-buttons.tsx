'use client'

import { Download, ScanLine, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'

interface RosterImportButtonsProps {
  visionLabel: string
  visionUploading: boolean
  onVisionClick: () => void
  onExport: () => void
  onImportJson: () => void
}

// Split out of RosterImportExport purely to stay under the file size budget.
export default function RosterImportButtons({
  visionLabel,
  visionUploading,
  onVisionClick,
  onExport,
  onImportJson,
}: Readonly<RosterImportButtonsProps>) {
  const { t } = useI18n()

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={onVisionClick}
        disabled={visionUploading}
        data-cy='import-vision-button'
      >
        <ScanLine className='mr-1.5 h-3.5 w-3.5' />
        {visionLabel}
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onExport}
        data-cy='export-json-button'
      >
        <Download className='mr-1.5 h-3.5 w-3.5' />
        {t.roster.importExport.exportJson}
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onImportJson}
        data-cy='import-json-button'
      >
        <Upload className='mr-1.5 h-3.5 w-3.5' />
        {t.roster.importExport.importJson}
      </Button>
    </div>
  )
}
