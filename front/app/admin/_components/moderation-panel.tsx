'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  listReports,
  resolveReport,
  type NoteReport,
} from '@/app/services/moderation';
import RevisionHistoryDialog from './revision-history-dialog';
import MutesWarnsSection from './mutes-warns-section';

const STATUSES = ['all', 'pending', 'resolved', 'dismissed'] as const;

export default function ModerationPanel() {
  const { t } = useI18n();
  const m = t.moderation;
  const [reports, setReports] = useState<NoteReport[]>([]);
  const [status, setStatus] = useState<string>('pending');
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [actionCount, setActionCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await listReports(status === 'all' ? undefined : status);
      setReports(res.items);
    } catch (err) {
      toast.error((err as Error).message || m.loadError);
    }
  }, [status, m.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const onResolve = async (id: string, action: 'delete' | 'dismiss') => {
    try {
      await resolveReport(id, action);
      toast.success(m.resolveSuccess);
      await load();
    } catch (err) {
      toast.error((err as Error).message || m.resolveError);
    }
  };

  const statusLabel = (s: string) =>
    ({ pending: m.statusPending, resolved: m.statusResolved, dismissed: m.statusDismissed }[s] ?? s);

  return (
    <div className='mt-6 flex flex-col gap-4' data-cy='moderation-panel'>
      <div className='flex items-center gap-3'>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-48' data-cy='moderation-status-filter'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} data-cy={`moderation-status-${s}`}>
                {s === 'all' ? m.statusAll : statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-x-auto rounded-md border border-border'>
        <table className='w-full text-sm' data-cy='moderation-reports-table'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colAlliance}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colLocation}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colNote}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colReporter}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colReason}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colStatus}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colDate}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td colSpan={8} className='px-3 py-8 text-center text-muted-foreground'>{m.noReports}</td>
              </tr>
            )}
            {reports.map((r) => (
              <tr key={r.id} className='border-t border-border hover:bg-muted/30' data-cy='moderation-report-row'>
                <td className='px-3 py-2 whitespace-nowrap'>{r.alliance_name}</td>
                <td className='px-3 py-2 whitespace-nowrap'>BG{r.battlegroup} · #{r.node_number}</td>
                <td className='px-3 py-2 max-w-48 truncate' title={r.note_content}>{r.note_content}</td>
                <td className='px-3 py-2 whitespace-nowrap'>{r.reporter_pseudo}</td>
                <td className='px-3 py-2 max-w-48 truncate' title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                <td className='px-3 py-2 whitespace-nowrap'>{statusLabel(r.status)}</td>
                <td className='px-3 py-2 whitespace-nowrap'>{new Date(r.created_at).toLocaleDateString()}</td>
                <td className='px-3 py-2'>
                  <div className='flex items-center gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      data-cy='moderation-view-history'
                      onClick={() => setHistoryNoteId(r.note_id)}
                    >
                      {m.viewHistory}
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      data-cy='moderation-delete'
                      onClick={() => setDeleteTarget(r.id)}
                    >
                      {m.delete}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      data-cy='moderation-dismiss'
                      onClick={() => onResolve(r.id, 'dismiss')}
                    >
                      {m.dismiss}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MutesWarnsSection refreshSignal={actionCount} />

      <RevisionHistoryDialog
        noteId={historyNoteId}
        onClose={() => setHistoryNoteId(null)}
        onActionDone={() => setActionCount((c) => c + 1)}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={m.deleteTitle}
        description={m.deleteDescription}
        variant='destructive'
        confirmText={m.delete}
        onConfirm={() => {
          if (deleteTarget) onResolve(deleteTarget, 'delete');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
