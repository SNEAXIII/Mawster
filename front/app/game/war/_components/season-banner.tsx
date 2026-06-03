'use client';

import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';
import type { SeasonFormat, SeasonStatus } from '@/app/services/season';

interface Props {
  season: { number: number } | null | undefined;
  format?: SeasonFormat;
  status?: SeasonStatus;
}

export default function SeasonBanner({ season, format, status }: Readonly<Props>) {
  const { t } = useI18n();

  if (season === undefined) return null;

  return (
    <div
      className='flex items-center gap-2'
      data-cy='season-banner'
    >
      {season ? (
        <Badge
          className='bg-green-600 text-white hover:bg-green-600'
          data-cy='season-active-badge'
        >
          {t.game.season.current.replace('{number}', String(season.number))}
        </Badge>
      ) : (
        <Badge
          variant='secondary'
          data-cy='season-off-season-badge'
        >
          {t.game.season.offSeason}
        </Badge>
      )}
      {status && status !== 'active' && (
        <Badge
          variant='secondary'
          data-cy='season-pre-season-badge'
        >
          {t.game.season.preSeason}
        </Badge>
      )}
      {format === 'big_thing' && (
        <Badge
          className='bg-amber-600 text-white hover:bg-amber-600'
          data-cy='season-format-banner'
        >
          {t.game.season.format.bigThing}
        </Badge>
      )}
    </div>
  );
}
