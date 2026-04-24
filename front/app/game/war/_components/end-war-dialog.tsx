'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/app/i18n';

interface EndWarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSeason: boolean;
  onConfirm: (win: boolean, eloChange: number | null) => void;
}

export default function EndWarDialog({
  open,
  onOpenChange,
  hasSeason,
  onConfirm,
}: Readonly<EndWarDialogProps>) {
  const { t } = useI18n();
  const [win, setWin] = useState(true);
  const [eloInput, setEloInput] = useState('');

  const parsedElo = eloInput === '' ? null : Number(eloInput);
  const eloValid =
    !hasSeason ||
    (parsedElo !== null &&
      !isNaN(parsedElo) &&
      parsedElo !== 0 &&
      (win ? parsedElo > 0 : parsedElo < 0));

  function handleConfirm() {
    if (!eloValid) return;
    onConfirm(win, hasSeason ? parsedElo : null);
    onOpenChange(false);
    setEloInput('');
    setWin(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy='end-war-dialog'>
        <DialogHeader>
          <DialogTitle>{t.game.war.endWarConfirmTitle}</DialogTitle>
          <DialogDescription>{t.game.war.endWarResultDesc}</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='flex items-center gap-3' data-cy='end-war-win-toggle'>
            <Label>{t.game.war.result}</Label>
            <div className='flex items-center gap-2'>
              <span
                className={
                  win ? 'text-sm font-semibold text-green-600' : 'text-sm text-muted-foreground'
                }
              >
                {t.game.war.win}
              </span>
              <Switch
                checked={!win}
                onCheckedChange={(checked) => {
                  setWin(!checked);
                  setEloInput('');
                }}
                data-cy='end-war-win-switch'
              />
              <span
                className={
                  !win ? 'text-sm font-semibold text-red-500' : 'text-sm text-muted-foreground'
                }
              >
                {t.game.war.lose}
              </span>
            </div>
          </div>

          {hasSeason && (
            <div className='space-y-1'>
              <Label htmlFor='elo-change'>{win ? t.game.war.eloGained : t.game.war.eloLost}</Label>
              <Input
                id='elo-change'
                type='number'
                placeholder={win ? '+50' : '-50'}
                value={eloInput}
                onChange={(e) => setEloInput(e.target.value)}
                data-cy='end-war-elo-input'
              />
              {eloInput !== '' && !eloValid && (
                <p className='text-xs text-red-500' data-cy='end-war-elo-error'>
                  {win ? t.game.war.eloMustBePositive : t.game.war.eloMustBeNegative}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            data-cy='end-war-cancel'
          >
            {t.common.cancel}
          </Button>
          <Button
            variant='destructive'
            disabled={!eloValid}
            onClick={handleConfirm}
            data-cy='confirmation-dialog-confirm'
          >
            {t.game.war.endWar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
