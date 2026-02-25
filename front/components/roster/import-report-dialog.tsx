'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { shortenChampionName } from '@/app/services/roster';

export interface ImportResult {
  champion_name: string;
  success: boolean;
  isNew: boolean;
  error?: string;
}

interface ImportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ImportResult[];
}

export default function ImportReportDialog({
  open,
  onOpenChange,
  results,
}: ImportReportDialogProps) {
  const { t } = useI18n();

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.roster.importExport.reportTitle}</DialogTitle>
          <DialogDescription className="flex items-center gap-3 mt-1">
            {successCount > 0 && (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                <FiCheck size={14} />{' '}
                {t.roster.importExport.successCount.replace('{count}', String(successCount))}
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <FiX size={14} />{' '}
                {t.roster.importExport.failCount.replace('{count}', String(failCount))}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`py-2 flex items-center gap-3 ${
                result.success ? '' : 'bg-red-50 dark:bg-red-950/30'
              }`}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {result.success ? (
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <FiCheck className="text-green-600" size={12} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <FiX className="text-red-600" size={12} />
                  </div>
                )}
              </div>

              {/* Champion name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {shortenChampionName(result.champion_name)}
                </p>
                {result.error && (
                  <p className="text-xs text-red-500 truncate" title={result.error}>
                    {result.error}
                  </p>
                )}
              </div>

              {/* Badge */}
              <div className="shrink-0">
                {result.success ? (
                  result.isNew ? (
                    <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                      {t.roster.importExport.badgeAdded}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                      {t.roster.importExport.badgeUpdated}
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <FiAlertTriangle size={9} /> {t.roster.importExport.badgeError}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button onClick={() => onOpenChange(false)}>
            {t.roster.importExport.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
