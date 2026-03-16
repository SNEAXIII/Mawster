'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateWarDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (opponentName: string) => Promise<void>;
}

export default function CreateWarDialog({ open, onClose, onConfirm }: CreateWarDialogProps) {
  const { t } = useI18n();
  const [opponentName, setOpponentName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentName.trim()) return;
    setLoading(true);
    try {
      await onConfirm(opponentName.trim());
      setOpponentName('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t.game.war.declareWar}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='py-4'>
            <Label htmlFor='opponent-name'>{t.game.war.opponentName}</Label>
            <Input
              id='opponent-name'
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder='e.g. Mighty Warriors'
              autoFocus
              className='mt-2'
              data-cy='opponent-name-input'
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
            >
              {t.common.cancel}
            </Button>
            <Button
              type='submit'
              disabled={!opponentName.trim() || loading}
              data-cy='create-war-confirm'
            >
              {loading ? '...' : t.game.war.declareWar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
