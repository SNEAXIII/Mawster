'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiFlag, FiTrash2 } from 'react-icons/fi';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { useWar } from '@/app/contexts/war-context';
import { useMyModeration } from '@/app/contexts/moderation-context';
import { reportNote } from '@/app/services/moderation';

interface WarNoteEditorProps {
  nodeNumber: number;
  note: string | null;
  noteId?: string | null;
  noteBlocked?: boolean;
  canManage: boolean;
  onSaved?: () => void;
}

export default function WarNoteEditor({
  nodeNumber,
  note,
  noteId,
  noteBlocked,
  canManage,
  onSaved,
}: Readonly<WarNoteEditorProps>) {
  const { t } = useI18n();
  const { handleSaveNote, handleDeleteNote } = useWar();
  const { mute } = useMyModeration();
  const [value, setValue] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reported, setReported] = useState(false);

  const muteNotice = mute && (
    <div
      className='flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400'
      data-cy='war-note-mute-notice'
    >
      <AlertTriangle className='h-3.5 w-3.5 shrink-0 mt-0.5' />
      <div className='flex flex-col'>
        <span className='font-semibold'>
          {t.moderation.muted}
        </span>
        <span>{mute.reason}</span>
        <span>
          {t.moderation.muteExpires}:{' '}
          {mute.expires_at ? new Date(mute.expires_at).toLocaleString() : t.moderation.noExpiry}
        </span>
      </div>
    </div>
  );

  const onReport = async () => {
    if (!noteId) return;
    try {
      await reportNote(noteId);
      setReported(true);
      toast.success(t.moderation.reportSuccess);
    } catch (err) {
      toast.error((err as Error).message || t.moderation.reportError);
    }
  };

  const reportButton = noteId && !noteBlocked && (
    <button
      className='flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
      data-cy='war-note-report'
      disabled={reported || !!mute}
      onClick={onReport}
    >
      <FiFlag className='h-3 w-3' />
      {reported ? t.moderation.reported : t.moderation.report}
    </button>
  );

  const blockedPlaceholder = (
    <p
      className='text-xs italic text-muted-foreground'
      data-cy='war-note-blocked'
    >
      {t.moderation.noteBlocked}
    </p>
  );

  if (!canManage) {
    if (!note && !noteBlocked) return null;
    return (
      <div className='border-t border-border/40 pt-2 flex flex-col gap-1'>
        <p className='text-[10px] text-muted-foreground'>{t.game.war.noteLabel}</p>
        {muteNotice}
        {noteBlocked ? (
          blockedPlaceholder
        ) : (
          <p
            className='text-xs whitespace-pre-wrap break-words'
            data-cy='war-note-readonly'
          >
            {note}
          </p>
        )}
        {reportButton}
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    try {
      await handleSaveNote(nodeNumber, value);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await handleDeleteNote(nodeNumber);
      setValue('');
      onSaved?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className='border-t border-border/40 pt-2 flex flex-col gap-1'>
      <p className='text-[10px] text-muted-foreground'>{t.game.war.noteLabel}</p>
      {noteBlocked && blockedPlaceholder}
      {muteNotice}
      <textarea
        className='w-full text-xs rounded border border-border bg-card p-1.5 resize-y min-h-14 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed'
        data-cy='war-note-input'
        placeholder={t.game.war.notePlaceholder}
        maxLength={2000}
        value={value}
        disabled={!!mute}
        onChange={(e) => setValue(e.target.value)}
      />
      <span className='text-[10px] text-muted-foreground self-end'>{value.length} / 2000</span>
      <button
        className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        data-cy='war-note-save'
        disabled={saving || !!mute || value.trim().length === 0 || value === (note ?? '')}
        onClick={onSave}
      >
        {t.game.war.noteSave}
      </button>
      {note && (
        <button
          className='flex items-center justify-center gap-1 w-full text-xs py-1 px-2 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          data-cy='war-note-delete'
          disabled={deleting}
          onClick={onDelete}
        >
          <FiTrash2 className='h-3 w-3' />
          {t.game.war.noteDelete}
        </button>
      )}
      {reportButton}
    </div>
  );
}
