'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMasteries, MasteryEntry } from '@/app/services/masteries';
import { useI18n } from '@/app/i18n';
import MasteryMiniView, { MasteryMode } from './mastery-mini-view';

interface MasteryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameAccountId: string;
  pseudo: string;
  defaultMode?: MasteryMode;
}

export default function MasteryDialog({
  open,
  onOpenChange,
  gameAccountId,
  pseudo,
  defaultMode = 'all',
}: Readonly<MasteryDialogProps>) {
  const { t } = useI18n();
  const [masteries, setMasteries] = useState<MasteryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !gameAccountId) return;
    setLoading(true);
    getMasteries(gameAccountId)
      .then(setMasteries)
      .catch(() => setMasteries([]))
      .finally(() => setLoading(false));
  }, [open, gameAccountId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle className='text-sm'>
            {t.mastery.title} — {pseudo}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className='text-sm text-muted-foreground'>{t.common.loading}</p>
        ) : (
          <MasteryMiniView masteries={masteries} defaultMode={defaultMode} />
        )}
      </DialogContent>
    </Dialog>
  );
}
