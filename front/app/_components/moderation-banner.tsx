'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { getMyModeration, type MyModeration } from '@/app/services/moderation';

export default function ModerationBanner() {
  const { t } = useI18n();
  const [data, setData] = useState<MyModeration | null>(null);

  useEffect(() => {
    getMyModeration()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;
  const hasMute = !!data.mute;
  const hasWarns = data.warns.length > 0;
  if (!hasMute && !hasWarns) return null;

  return (
    <div className='flex flex-col gap-2 mb-4' data-cy='moderation-banner'>
      {data.mute && (
        <div
          className='flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          data-cy='moderation-mute'
        >
          <Ban className='h-4 w-4 shrink-0 mt-0.5' />
          <div className='flex flex-col'>
            <span className='font-semibold'>{t.moderation.muted}</span>
            <span>{data.mute.reason}</span>
          </div>
        </div>
      )}
      {data.warns.map((w) => (
        <div
          key={`${w.created_at}-${w.reason}`}
          className='flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400'
          data-cy='moderation-warn'
        >
          <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
          <div className='flex flex-col'>
            <span className='font-semibold'>{t.moderation.warned}</span>
            <span>{w.reason}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
