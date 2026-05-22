'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { listSeasons, createSeason, type Season } from '@/app/services/season';
import {
  getAppConfig,
  setCurrentSeason,
  setOffSeasonBigThing,
  type AppConfigData,
} from '@/app/services/app-config';
import { SeasonRow } from './season-row';

export default function SeasonsPanel() {
  const { t } = useI18n();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [newNumber, setNewNumber] = useState('');
  const [newBigThing, setNewBigThing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([listSeasons(), getAppConfig()]);
      setSeasons(s);
      setConfig(c);
    } catch {
      setError(t.game.season.admin.createError);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const n = parseInt(newNumber, 10);
    if (isNaN(n)) return;
    try {
      await createSeason(n, newBigThing);
      setNewNumber('');
      setNewBigThing(false);
      await load();
    } catch {
      setError(t.game.season.admin.createError);
    }
  };

  const handleSetCurrent = async (id: string | null) => {
    try {
      const updated = await setCurrentSeason(id);
      setConfig(updated);
    } catch {
      setError(t.game.season.admin.activateError);
    }
  };

  const handleOffSeasonBigThing = async () => {
    if (!config) return;
    try {
      const updated = await setOffSeasonBigThing(!config.off_season_big_thing);
      setConfig(updated);
    } catch {
      setError(t.game.season.admin.deactivateError);
    }
  };

  return (
    <div className='mt-6 flex flex-col gap-4' data-cy='seasons-panel'>
      <h2 className='text-lg font-semibold'>{t.game.season.admin.title}</h2>

      <div className='flex items-center gap-3'>
        <Switch
          checked={config?.off_season_big_thing ?? false}
          onCheckedChange={handleOffSeasonBigThing}
          disabled={config?.current_season_id !== null}
          data-cy='off-season-big-thing-toggle'
        />
        <span className='text-sm'>{t.game.season.admin.offSeasonBigThing}</span>
      </div>

      <div className='flex gap-2 items-center'>
        <Input
          type='text'
          inputMode='numeric'
          placeholder={t.game.season.admin.numberPlaceholder}
          value={newNumber}
          onKeyDown={(e) => {
            if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ''))}
          className='w-32'
          data-cy='season-number-input'
        />
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={newBigThing}
            onChange={(e) => setNewBigThing(e.target.checked)}
            data-cy='season-big-thing-checkbox'
          />
          {t.game.season.admin.bigThingLabel}
        </label>
        <Button onClick={handleCreate} data-cy='create-season-btn'>
          {t.game.season.admin.createButton}
        </Button>
      </div>

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <div className='flex flex-col gap-2'>
        {config && seasons.map((s) => (
          <SeasonRow key={s.id} season={s} config={config} onSetCurrent={handleSetCurrent} />
        ))}
      </div>
    </div>
  );
}
