'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { useWar } from '@/app/contexts/war-context';

interface WarNoteEditorProps {
  nodeNumber: number;
  note: string | null;
  canManage: boolean;
  onSaved: () => void;
}

export default function WarNoteEditor({
  nodeNumber,
  note,
  canManage,
  onSaved,
}: Readonly<WarNoteEditorProps>) {
  const { t } = useI18n();
  const { handleSaveNote } = useWar();
  const [value, setValue] = useState(note ?? '');
  const [saving, setSaving] = useState(false);

  if (!canManage) {
    if (!note) return null;
    return (
      <div className='border-t border-border/40 pt-2 flex flex-col gap-1'>
        <p className='text-[10px] text-muted-foreground'>{t.game.war.noteLabel}</p>
        <p
          className='text-xs whitespace-pre-wrap break-words'
          data-cy='war-note-readonly'
        >
          {note}
        </p>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    try {
      await handleSaveNote(nodeNumber, value);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='border-t border-border/40 pt-2 flex flex-col gap-1'>
      <p className='text-[10px] text-muted-foreground'>{t.game.war.noteLabel}</p>
      <textarea
        className='w-full text-xs rounded border border-border bg-card p-1.5 resize-y min-h-14 focus:outline-none focus:ring-1 focus:ring-primary'
        data-cy='war-note-input'
        placeholder={t.game.war.notePlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        data-cy='war-note-save'
        disabled={saving}
        onClick={onSave}
      >
        {t.game.war.noteSave}
      </button>
    </div>
  );
}
