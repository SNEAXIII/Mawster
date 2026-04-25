'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listSeasons,
  createSeason,
  activateSeason,
  deactivateSeason,
  type Season,
} from '@/app/services/season';

export default function SeasonsPanel() {
  const { t } = useI18n();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      await createSeason(n);
      setNewNumber('');
      await load();
    } catch {
      setError(t.game.season.admin.createError);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateSeason(id);
      await load();
    } catch {
      setError(t.game.season.admin.activateError);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateSeason(id);
      await load();
    } catch {
      setError(t.game.season.admin.deactivateError);
    }
  };

  return (
    <div
      className='mt-6 space-y-4'
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
        <Button
          onClick={handleCreate}
          data-cy='create-season-btn'
        >
          {t.game.season.admin.createButton}
        </Button>
      </div>

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <div className='space-y-2'>
        {seasons.map((s) => (
          <div
            key={s.id}
            className='flex items-center justify-between rounded-md border px-4 py-2'
            data-cy={`season-row-${s.number}`}
          >
            <div className='flex items-center gap-3'>
              <span className='font-medium'>Season {s.number}</span>
              <Badge
                variant={s.is_active ? 'default' : 'secondary'}
                className={s.is_active ? 'bg-green-600 text-white hover:bg-green-600' : ''}
                data-cy={s.is_active ? 'season-active-indicator' : 'season-inactive-indicator'}
              >
                {s.is_active ? t.game.season.admin.active : t.game.season.admin.inactive}
              </Badge>
            </div>
            <div className='flex gap-2'>
              {!s.is_active && (
                <Button
                  size='sm'
                  onClick={() => handleActivate(s.id)}
                  data-cy={`activate-season-${s.number}`}
                >
                  {t.game.season.admin.activateButton}
                </Button>
              )}
              {s.is_active && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => handleDeactivate(s.id)}
                  data-cy={`deactivate-season-${s.number}`}
                >
                  {t.game.season.admin.deactivateButton}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
