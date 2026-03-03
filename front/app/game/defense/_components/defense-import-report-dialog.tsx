'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { DefenseImportReport } from '@/app/services/defense';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  report: DefenseImportReport | null;
}

export default function DefenseImportReportDialog({ open, onClose, report }: Props) {
  const { t } = useI18n();
  if (!report) return null;

  const ti = t.game.defense.importExport;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{ti.reportTitle}</DialogTitle>
          <DialogDescription>
            {ti.reportSummary
              .replace('{ok}', String(report.success_count))
              .replace('{err}', String(report.error_count))}
          </DialogDescription>
        </DialogHeader>

        {/* Errors */}
        {report.errors.length > 0 && (
          <div className='space-y-1'>
            <h4 className='text-sm font-semibold flex items-center gap-1 text-destructive'>
              <XCircle className='w-4 h-4' />
              {ti.errors} ({report.errors.length})
            </h4>
            <ul className='text-xs space-y-1 max-h-40 overflow-y-auto'>
              {report.errors.map((e, i) => (
                <li key={i} className='bg-destructive/10 rounded px-2 py-1'>
                  <span className='font-medium'>
                    Node {e.node_number} — {e.champion_name} ({e.owner_name}):
                  </span>{' '}
                  {e.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Before / After comparison */}
        <div className='grid grid-cols-2 gap-3 text-xs'>
          {/* Before */}
          <div>
            <h4 className='text-sm font-semibold flex items-center gap-1 mb-1'>
              <AlertTriangle className='w-4 h-4 text-amber-500' />
              {ti.before} ({report.before.length})
            </h4>
            {report.before.length === 0 ? (
              <p className='text-muted-foreground italic'>{ti.empty}</p>
            ) : (
              <ul className='space-y-0.5 max-h-40 overflow-y-auto'>
                {report.before.map((p, i) => (
                  <li key={i} className='bg-muted rounded px-2 py-0.5'>
                    #{p.node_number} {p.champion_name} {p.rarity} — {p.owner_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* After */}
          <div>
            <h4 className='text-sm font-semibold flex items-center gap-1 mb-1'>
              <CheckCircle className='w-4 h-4 text-green-500' />
              {ti.after} ({report.after.length})
            </h4>
            {report.after.length === 0 ? (
              <p className='text-muted-foreground italic'>{ti.empty}</p>
            ) : (
              <ul className='space-y-0.5 max-h-40 overflow-y-auto'>
                {report.after.map((p, i) => (
                  <li key={i} className='bg-muted rounded px-2 py-0.5'>
                    #{p.node_number} {p.champion_name} {p.rarity} — {p.owner_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t.common.close ?? 'Close'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
