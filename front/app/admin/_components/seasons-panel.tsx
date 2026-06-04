'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  listSeasons,
  createSeason,
  openSeason,
  closeSeason,
  revertSeason,
  type Season,
  type SeasonFormat,
} from '@/app/services/season';
import { ConfirmationDialog } from '@/components/confirmation-dialog';

export default function SeasonsPanel() {
  const { t } = useI18n();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newFormat, setNewFormat] = useState<SeasonFormat>('regular');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    action: 'open' | 'close' | 'revert';
  } | null>(null);

  const load = async () => {
    try {
      setSeasons(await listSeasons());
    } catch {
      setError(t.game.season.admin.createError);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const n = parseInt(newNumber, 10);
    if (isNaN(n)) return;
    try {
      await createSeason(n, newFormat);
      setNewNumber('');
      setNewFormat('regular');
      await load();
    } catch {
      setError(t.game.season.admin.createError);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      await openSeason(id);
      await load();
    } catch {
      setError(t.game.season.admin.openError);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await closeSeason(id);
      await load();
    } catch {
      setError(t.game.season.admin.closeError);
    }
  };

  const handleRevert = async (id: string) => {
    try {
      await revertSeason(id);
      await load();
    } catch {
      setError(t.game.season.admin.revertError);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { id, action } = confirm;
    setConfirm(null);
    if (action === 'open') await handleOpen(id);
    else if (action === 'close') await handleClose(id);
    else await handleRevert(id);
  };

  return (
    <div
      className='mt-6 flex flex-col gap-4'
      data-cy='seasons-panel'
    >
      <h2 className='text-lg font-semibold'>{t.game.season.admin.title}</h2>

      <div className='flex gap-2 items-center'>
        <Input
          type='text'
          inputMode='numeric'
          placeholder={t.game.season.admin.numberPlaceholder}
          value={newNumber}
          onKeyDown={(e) => {
            if (
              !/^\d$/.test(e.key) &&
              !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)
            ) {
              e.preventDefault();
            }
          }}
          onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ''))}
          className='w-32'
          data-cy='season-number-input'
        />
        <Select
          value={newFormat}
          onValueChange={(v) => setNewFormat(v as SeasonFormat)}
        >
          <SelectTrigger
            className='w-40'
            data-cy='season-format-select'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='regular'>{t.game.season.format.regular}</SelectItem>
            <SelectItem value='big_thing'>{t.game.season.format.bigThing}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleCreate}
          data-cy='create-season-btn'
        >
          {t.game.season.admin.createButton}
        </Button>
      </div>

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <div className='flex flex-col gap-2'>
        {seasons.map((s) => (
          <div
            key={s.id}
            className='flex items-center justify-between rounded-md border px-4 py-2'
            data-cy={`season-row-${s.number}`}
          >
            <div className='flex items-center gap-3'>
              <span className='font-medium'>Season {s.number}</span>
              <Badge
                variant={s.status === 'active' ? 'default' : 'secondary'}
                className={
                  s.status === 'active' ? 'bg-primary text-primary-foreground hover:bg-primary' : ''
                }
                data-cy={`season-status-${s.status}`}
              >
                {s.status === 'active'
                  ? t.game.season.admin.statusActive
                  : s.status === 'ended'
                    ? t.game.season.admin.statusEnded
                    : t.game.season.admin.statusUpcoming}
              </Badge>
              <Badge
                variant='outline'
                data-cy={`season-format-${s.number}`}
              >
                {s.format === 'big_thing'
                  ? t.game.season.format.bigThing
                  : t.game.season.format.regular}
              </Badge>
            </div>
            <div className='flex gap-2'>
              {s.status !== 'active' && (
                <Button
                  size='sm'
                  onClick={() => setConfirm({ id: s.id, action: 'open' })}
                  data-cy={`open-season-${s.number}`}
                >
                  {t.game.season.admin.openButton}
                </Button>
              )}
              {s.status === 'active' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setConfirm({ id: s.id, action: 'close' })}
                  data-cy={`close-season-${s.number}`}
                >
                  {t.game.season.admin.closeButton}
                </Button>
              )}
              {s.status === 'ended' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setConfirm({ id: s.id, action: 'revert' })}
                  data-cy={`revert-season-${s.number}`}
                >
                  {t.game.season.admin.revertButton}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
        title={
          confirm?.action === 'close'
            ? t.game.season.admin.confirmCloseTitle
            : confirm?.action === 'revert'
              ? t.game.season.admin.confirmRevertTitle
              : t.game.season.admin.confirmOpenTitle
        }
        description={
          confirm?.action === 'close'
            ? t.game.season.admin.confirmCloseBody
            : confirm?.action === 'revert'
              ? t.game.season.admin.confirmRevertBody
              : t.game.season.admin.confirmOpenBody
        }
        onConfirm={runConfirm}
      />
    </div>
  );
}
