'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { getCurrentSeason, type Season } from '@/app/services/season';
import { Badge } from '@/components/ui/badge';

export default function SeasonBanner() {
  const { t } = useI18n();
  const [season, setSeason] = useState<Season | null | undefined>(undefined);

  useEffect(() => {
    getCurrentSeason().then(setSeason).catch(() => setSeason(null));
  }, []);

  if (season === undefined) return null;

  return (
    <div className="flex items-center gap-2" data-cy="season-banner">
      {season ? (
        <Badge className="bg-green-600 text-white hover:bg-green-600" data-cy="season-active-badge">
          {t.game.season.current.replace('{number}', String(season.number))}
        </Badge>
      ) : (
        <Badge variant="secondary" data-cy="season-off-season-badge">
          {t.game.season.offSeason}
        </Badge>
      )}
    </div>
  );
}
