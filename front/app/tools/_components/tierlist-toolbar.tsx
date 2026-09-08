'use client'

import { useRef, useState } from 'react'
import { Download, Image as ImageIcon, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useI18n } from '@/app/i18n'

interface TierListToolbarProps {
  busy: boolean
  onExportJson: () => void
  onImportJson: (file: File) => void
  onExportPng: () => void
  onReset: () => void
}

/** Export, import and reset. Nothing here touches the board itself. */
export default function TierListToolbar({
  busy,
  onExportJson,
  onImportJson,
  onExportPng,
  onReset,
}: Readonly<TierListToolbarProps>) {
  const { t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={onExportPng}
        disabled={busy}
        data-cy='tierlist-export-png'
      >
        <ImageIcon className='size-4' />
        {t.tierlist.exportPng}
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onExportJson}
        data-cy='tierlist-export-json'
      >
        <Download className='size-4' />
        {t.tierlist.exportJson}
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={() => fileInput.current?.click()}
        data-cy='tierlist-import-json'
      >
        <Upload className='size-4' />
        {t.tierlist.importJson}
      </Button>
      <input
        ref={fileInput}
        type='file'
        accept='application/json'
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImportJson(file)
          // Clear it, or picking the same file twice in a row fires nothing.
          event.target.value = ''
        }}
      />
      <Button
        variant='ghost'
        size='sm'
        onClick={() => setConfirmingReset(true)}
        data-cy='tierlist-reset'
        className='text-muted-foreground hover:text-destructive'
      >
        <RotateCcw className='size-4' />
        {t.tierlist.reset}
      </Button>

      <ConfirmationDialog
        open={confirmingReset}
        onOpenChange={setConfirmingReset}
        title={t.tierlist.reset}
        description={t.tierlist.resetConfirm}
        onConfirm={() => {
          onReset()
          setConfirmingReset(false)
        }}
      />
    </div>
  )
}
