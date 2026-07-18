'use client'

import React from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import ImportPreviewRow, { type PreviewRow, type PreviewRowPatch } from './import-preview-row'

interface ImportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewRows: PreviewRow[]
  importing: boolean
  onImport: () => void
  editable?: boolean
  onRowChange?: (index: number, patch: PreviewRowPatch) => void
  shareDataset?: boolean
  onShareDatasetChange?: (checked: boolean) => void
}

export default function ImportPreviewDialog({
  open,
  onOpenChange,
  previewRows,
  importing,
  onImport,
  editable = false,
  onRowChange,
  shareDataset = false,
  onShareDatasetChange,
}: ImportPreviewDialogProps) {
  const { t } = useI18n()

  const newCount = previewRows.filter((r) => r.isNew).length
  const changeCount = previewRows.filter((r) => !r.isNew && r.hasChanges).length
  const unchangedCount = previewRows.filter((r) => !r.isNew && !r.hasChanges).length

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>{t.roster.importExport.previewTitle}</DialogTitle>
          <DialogDescription>
            {t.roster.importExport.detectedCount.replace('{count}', String(previewRows.length))} —
            <span className='text-green-600 font-medium'>
              {t.roster.importExport.newCount.replace('{count}', String(newCount))}
            </span>
            ,
            <span className='text-blue-600 font-medium'>
              {t.roster.importExport.updateCount.replace('{count}', String(changeCount))}
            </span>
            ,
            <span className='text-gray-500'>
              {t.roster.importExport.unchangedCount.replace('{count}', String(unchangedCount))}
            </span>
          </DialogDescription>
        </DialogHeader>

        {editable && (
          <p className='text-xs text-muted-foreground'>{t.roster.importExport.editHint}</p>
        )}

        {/* Scrollable list */}
        <div className='flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2'>
          {previewRows.map((row, index) => (
            <ImportPreviewRow
              // Keyed on fields the user cannot edit: newRarity is editable, and
              // keying on it remounts the row on every rarity change, dropping focus.
              key={row.prediction_id ?? `${row.champion_name}_${index}`}
              row={row}
              index={index}
              onRowChange={onRowChange}
            />
          ))}
        </div>

        {editable && (
          <div className='flex items-center gap-2 pt-2'>
            <Checkbox
              id='import-preview-share-dataset'
              checked={shareDataset}
              onCheckedChange={(checked) => onShareDatasetChange?.(checked === true)}
              data-cy='import-share-dataset-checkbox'
            />
            <Label htmlFor='import-preview-share-dataset'>
              {t.roster.importExport.vision.shareDataset}
            </Label>
          </div>
        )}

        <DialogFooter className='pt-3 border-t'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            {t.roster.importExport.cancel}
          </Button>
          <Button
            onClick={onImport}
            disabled={importing || newCount + changeCount === 0}
          >
            {importing
              ? t.roster.importExport.importing
              : t.roster.importExport.importButton.replace(
                  '{count}',
                  String(newCount + changeCount)
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
