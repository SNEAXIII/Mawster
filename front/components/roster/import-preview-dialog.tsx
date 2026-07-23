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
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import ImportPreviewRow, { type PreviewRow, type PreviewRowPatch } from './import-preview-row'
import { marginLevel, type MarginLevel } from './import-preview-row-edit'

// Most ambiguous first: the rows most likely misread lead, the clean matches
// sink to the bottom. Ambiguous and uncertain open by default; clear matches
// collapse — they rarely need a look, and hiding them shortens the scroll.
const LEVEL_ORDER: readonly MarginLevel[] = ['low', 'medium', 'high']
const LEVEL_OPEN_BY_DEFAULT: Record<MarginLevel, boolean> = {
  low: true,
  medium: true,
  high: false,
}

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
        <div className='flex-1 overflow-y-auto px-2'>
          {editable ? (
            <MarginGroupedRows
              previewRows={previewRows}
              onRowChange={onRowChange}
            />
          ) : (
            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
              {previewRows.map((row, index) => (
                <ImportPreviewRow
                  // Keyed on fields the user cannot edit: newRarity is editable,
                  // and keying on it remounts the row on every rarity change,
                  // dropping focus.
                  key={row.prediction_id ?? `${row.champion_name}_${index}`}
                  row={row}
                  index={index}
                  onRowChange={onRowChange}
                />
              ))}
            </div>
          )}
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
            data-cy='import-preview-confirm-button'
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

interface MarginGroupedRowsProps {
  previewRows: PreviewRow[]
  onRowChange?: (index: number, patch: PreviewRowPatch) => void
}

// Groups the review rows by margin level, most ambiguous first. The row's
// ORIGINAL index in previewRows is carried through untouched: onRowChange finds
// the row by that index, so re-indexing the grouped list would make a
// correction mutate the wrong row and write a wrong rarity to the roster.
function MarginGroupedRows({ previewRows, onRowChange }: Readonly<MarginGroupedRowsProps>) {
  const { t } = useI18n()

  const groups: Record<MarginLevel, { row: PreviewRow; index: number }[]> = {
    low: [],
    medium: [],
    high: [],
  }
  previewRows.forEach((row, index) => {
    groups[marginLevel(row.margin)].push({ row, index })
  })

  const labels: Record<MarginLevel, string> = {
    low: t.roster.importExport.vision.marginAmbiguous,
    medium: t.roster.importExport.vision.marginUncertain,
    high: t.roster.importExport.vision.marginClear,
  }

  return (
    <div className='flex flex-col gap-2'>
      {LEVEL_ORDER.map((level) => {
        const rows = groups[level]
        if (rows.length === 0) return null
        return (
          <Collapsible
            key={level}
            defaultOpen={LEVEL_OPEN_BY_DEFAULT[level]}
            data-cy={`preview-group-${level}`}
          >
            <CollapsibleTrigger
              className='flex w-full items-center gap-2 py-1.5 text-sm font-medium [&[data-state=open]>svg]:rotate-180'
              data-cy={`preview-group-toggle-${level}`}
            >
              <ChevronDown className='h-4 w-4 transition-transform' />
              <span>{labels[level]}</span>
              <span className='text-muted-foreground'>{rows.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                {rows.map(({ row, index }) => (
                  <ImportPreviewRow
                    key={row.prediction_id ?? `${row.champion_name}_${index}`}
                    row={row}
                    index={index}
                    onRowChange={onRowChange}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
