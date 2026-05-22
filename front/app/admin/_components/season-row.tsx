'use client';

import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Season } from '@/app/services/season';
import type { AppConfigData } from '@/app/services/app-config';

interface SeasonRowProps {
  season: Season;
  config: AppConfigData;
  onSetCurrent: (id: string | null) => void;
}

export function SeasonRow({ season, config, onSetCurrent }: SeasonRowProps) {
  const { t } = useI18n();
  const isCurrent = season.id === config.current_season_id;
  return (
    <div
      className='flex items-center justify-between rounded-md border px-4 py-2'
      data-cy={`season-row-${season.number}`}
    >
      <div className='flex items-center gap-3'>
        <span className='font-medium'>{t.game.season.current.replace('{number}', String(season.number))}</span>
        {season.is_big_thing && (
          <Badge variant='outline' title={t.game.season.admin.bigThingTooltip}>
            {t.game.season.admin.bigThingLabel}
          </Badge>
        )}
        {isCurrent && (
          <Badge data-cy='season-current-indicator'>{t.game.season.admin.currentSeason}</Badge>
        )}
      </div>
      <div className='flex gap-2'>
        {!isCurrent && (
          <Button
            size='sm'
            onClick={() => onSetCurrent(season.id)}
            data-cy={`set-current-season-${season.number}`}
          >
            {t.game.season.admin.setCurrentSeason}
          </Button>
        )}
        {isCurrent && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => onSetCurrent(null)}
            data-cy='set-off-season-btn'
          >
            {t.game.season.admin.offSeasonMode}
          </Button>
        )}
      </div>
    </div>
  );
}
