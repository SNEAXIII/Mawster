'use client';

import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';

interface Props {
  season: { number: number } | null | undefined;
}

export default function SeasonBanner({ season }: Readonly<Props>) {
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
    </div>
  );
}
