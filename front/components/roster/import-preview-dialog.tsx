'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ImportPreviewRow, { type PreviewRow } from './import-preview-row';

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewRows: PreviewRow[];
  importing: boolean;
  onImport: () => void;
}

export default function ImportPreviewDialog({
  open,
  onOpenChange,
  previewRows,
  importing,
  onImport,
}: ImportPreviewDialogProps) {
  const { t } = useI18n();

  const newCount = previewRows.filter((r) => r.isNew).length;
  const changeCount = previewRows.filter((r) => !r.isNew && r.hasChanges).length;
  const unchangedCount = previewRows.filter((r) => !r.isNew && !r.hasChanges).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.roster.importExport.previewTitle}</DialogTitle>
          <DialogDescription>
            {t.roster.importExport.detectedCount.replace('{count}', String(previewRows.length))} —{' '}
            <span className="text-green-600 font-medium">
              {t.roster.importExport.newCount.replace('{count}', String(newCount))}
            </span>
            ,{' '}
            <span className="text-blue-600 font-medium">
              {t.roster.importExport.updateCount.replace('{count}', String(changeCount))}
            </span>
            ,{' '}
            <span className="text-gray-500">
              {t.roster.importExport.unchangedCount.replace('{count}', String(unchangedCount))}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2">
          {previewRows.map((row) => (
            <ImportPreviewRow key={`${row.champion_name}_${row.newRarity}`} row={row} />
          ))}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
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
                  String(newCount + changeCount),
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
