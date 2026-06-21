'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/app/i18n';
import { getRevisions, type NoteRevision } from '@/app/services/moderation';

type RevisionHistoryDialogProps = Readonly<{
  noteId: string | null;
  onClose: () => void;
}>;

export default function RevisionHistoryDialog({ noteId, onClose }: RevisionHistoryDialogProps) {
  const { t } = useI18n();
  const m = t.moderation;
  const [revisions, setRevisions] = useState<NoteRevision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    setLoading(true);
    getRevisions(noteId)
      .then(setRevisions)
      .catch(() => setRevisions([]))
      .finally(() => setLoading(false));
  }, [noteId]);

  return (
    <Dialog open={!!noteId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-cy='moderation-revisions-dialog'>
        <DialogHeader>
          <DialogTitle>{m.revisionsTitle}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className='text-sm text-muted-foreground'>{t.common.loading}</p>
        ) : revisions.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{m.noRevisions}</p>
        ) : (
          <ul className='flex flex-col gap-3 max-h-96 overflow-y-auto'>
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className='rounded-md border border-border bg-card p-3 flex flex-col gap-1'
                data-cy='moderation-revision-row'
              >
                <p className='text-sm whitespace-pre-wrap break-words'>{rev.content}</p>
                <p className='text-xs text-muted-foreground'>
                  {rev.edited_by_pseudo ?? '—'} · {new Date(rev.edited_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
